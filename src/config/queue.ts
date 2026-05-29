import { Queue, Worker, Job } from 'bullmq';
import dns from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';
import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { getEnv } from './env';

const env = getEnv();

const connection = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  tls: env.redis.tls ? {} : undefined,
};

function getSmtpSocket(
  options: SMTPTransport.Options,
  callback: (err: Error | null, socketOptions?: { connection: net.Socket | tls.TLSSocket; host: string; servername: string }) => void
): void {
  const host = options.host || env.smtp.host;
  const port = options.port || env.smtp.port;

  dns.lookup(host, { family: env.smtp.family }, (dnsError, address) => {
    if (dnsError) {
      callback(dnsError);
      return;
    }

    const socket = options.secure
      ? tls.connect({ host: address, port, servername: host })
      : net.connect({ host: address, port });

    const onError = (error: Error) => {
      socket.destroy();
      callback(error);
    };

    socket.once('error', onError);
    socket.once('connect', () => {
      socket.removeListener('error', onError);
      callback(null, {
        connection: socket,
        host,
        servername: host,
      });
    });
  });
}

const smtpTransportOptions: SMTPTransport.Options = {
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  getSocket: getSmtpSocket,
  tls: {
    rejectUnauthorized: env.smtp.rejectUnauthorized,
  },
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
};

export const transporter = nodemailer.createTransport(smtpTransportOptions);

const EMAIL_QUEUE_NAME = 'email-queue';
const isSmtpConfigured = Boolean(env.smtp.user && env.smtp.pass);
const isMailerSendConfigured = Boolean(env.email.mailerSendApiToken);
const isGmailApiConfigured = Boolean(
  env.gmail.clientId &&
    env.gmail.clientSecret &&
    env.gmail.refreshToken &&
    env.gmail.user
);

const maskEmail = (email: string): string => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
};

console.log(
  `Email provider: ${
    isGmailApiConfigured
      ? `Gmail API ${maskEmail(env.gmail.user)}`
      : isMailerSendConfigured
      ? 'MailerSend HTTPS API'
      : isSmtpConfigured
      ? `SMTP ${env.smtp.host}:${env.smtp.port} IPv${env.smtp.family}`
      : 'disabled'
  }`
);

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export interface EmailJobData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

async function sendEmailNow(data: EmailJobData): Promise<void> {
  if (!isSmtpConfigured) {
    console.warn('SMTP is not configured. Skipping email send.');
    return;
  }

  const { to, subject, text, html } = data;
  const info = await transporter.sendMail({
    from: env.email.from,
    to,
    subject,
    text,
    html,
  });
  console.log(`Email sent to ${maskEmail(to)}: ${info.messageId}`);
}

function encodeMimeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildMimeMessage(data: EmailJobData): string {
  const boundary = `bookstore-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sender = parseSender(env.email.from || env.gmail.user);
  const from = sender.name ? `${encodeMimeHeader(sender.name)} <${sender.email}>` : sender.email;
  const headers = [
    `From: ${from}`,
    `To: ${data.to}`,
    `Subject: ${encodeMimeHeader(data.subject)}`,
    'MIME-Version: 1.0',
  ];

  if (data.text && data.html) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      data.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      data.html,
      `--${boundary}--`,
      '',
    ].join('\r\n');
  }

  const contentType = data.html ? 'text/html' : 'text/plain';

  return [
    ...headers,
    `Content-Type: ${contentType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: 8bit',
    '',
    data.html || data.text || '',
  ].join('\r\n');
}

async function getGmailAccessToken(): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.gmail.clientId,
      client_secret: env.gmail.clientSecret,
      refresh_token: env.gmail.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const body = await response.json().catch(() => null) as { access_token?: string; error?: string; error_description?: string } | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(
      `Gmail OAuth refresh failed with status ${response.status}: ${body?.error_description || body?.error || 'unknown error'}`
    );
  }

  return body.access_token;
}

async function sendEmailViaGmailApi(data: EmailJobData): Promise<void> {
  if (!isGmailApiConfigured) {
    throw new Error('Gmail API is not configured');
  }

  const accessToken = await getGmailAccessToken();
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(env.gmail.user)}/messages/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodeBase64Url(buildMimeMessage(data)),
      }),
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Gmail API send failed with status ${response.status}: ${body}`);
  }

  const result = body ? JSON.parse(body) as { id?: string } : {};
  console.log(`Email sent via Gmail API to ${maskEmail(data.to)}: ${result.id || 'accepted'}`);
}

function parseSender(value: string): { name?: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) {
    return { email: value.trim() };
  }

  return {
    name: match[1]?.trim() || undefined,
    email: match[2].trim(),
  };
}

async function sendEmailViaMailerSend(data: EmailJobData): Promise<void> {
  if (!isMailerSendConfigured) {
    throw new Error('MAILERSEND_API_TOKEN is not configured');
  }

  const sender = parseSender(env.email.from);

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.email.mailerSendApiToken}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: {
        email: sender.email,
        ...(sender.name ? { name: sender.name } : {}),
      },
      to: [{ email: data.to }],
      subject: data.subject,
      text: data.text,
      html: data.html,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`MailerSend API failed with status ${response.status}: ${body}`);
  }

  console.log(`Email sent via MailerSend to ${maskEmail(data.to)}: ${response.headers.get('x-message-id') || 'accepted'}`);
}

export async function dispatchEmail(jobName: string, data: EmailJobData): Promise<void> {
  if (!isGmailApiConfigured && !isMailerSendConfigured && !isSmtpConfigured) {
    console.warn(`No email provider configured. Skipping job "${jobName}" for ${data.to}.`);
    return;
  }

  if (isGmailApiConfigured) {
    try {
      await sendEmailViaGmailApi(data);
      return;
    } catch (error) {
      console.error(`Direct Gmail API send failed for job "${jobName}". Falling back to queue retry.`, error);
    }

    try {
      await emailQueue.add(jobName, data);
      return;
    } catch (queueError) {
      console.error(`Queue fallback failed for job "${jobName}".`, queueError);
      throw queueError;
    }
  }

  if (isMailerSendConfigured) {
    await sendEmailViaMailerSend(data);
    return;
  }

  try {
    await sendEmailNow(data);
    return;
  } catch (error) {
    console.error(`Direct SMTP send failed for job "${jobName}". Falling back to queue retry.`, error);
  }

  try {
    await emailQueue.add(jobName, data);
  } catch (queueError) {
    console.error(`Queue fallback failed for job "${jobName}".`, queueError);
    throw queueError;
  }
}

const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    try {
      if (isGmailApiConfigured) {
        await sendEmailViaGmailApi(job.data);
        return;
      }

      if (isMailerSendConfigured) {
        await sendEmailViaMailerSend(job.data);
        return;
      }

      await sendEmailNow(job.data);
    } catch (error) {
      console.error(`Failed to send email to ${job.data.to}:`, error);
      throw error;
    }
  },
  { connection }
);

emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} has failed with ${err.message}`);
});
