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
const isMailjetConfigured = Boolean(env.email.mailjetApiKey && env.email.mailjetSecretKey);

const maskEmail = (email: string): string => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
};

console.log(
  `Email provider: ${
    isMailjetConfigured
      ? 'Mailjet HTTPS API'
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

async function sendEmailViaMailjet(data: EmailJobData): Promise<void> {
  if (!isMailjetConfigured) {
    throw new Error('MAILJET_API_KEY or MAILJET_SECRET_KEY is not configured');
  }

  const sender = parseSender(env.email.from);
  const auth = Buffer.from(`${env.email.mailjetApiKey}:${env.email.mailjetSecretKey}`).toString('base64');

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: sender.email,
            ...(sender.name ? { Name: sender.name } : {}),
          },
          To: [{ Email: data.to }],
          Subject: data.subject,
          TextPart: data.text,
          HTMLPart: data.html,
        },
      ],
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Mailjet API failed with status ${response.status}: ${body}`);
  }

  try {
    const parsed = JSON.parse(body) as {
      Messages?: Array<{ To?: Array<{ MessageID?: number | string; MessageUUID?: string }> }>;
    };
    const message = parsed.Messages?.[0]?.To?.[0];
    console.log(`Email sent via Mailjet to ${maskEmail(data.to)}: ${message?.MessageUUID || message?.MessageID || 'accepted'}`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.log(`Email sent via Mailjet to ${maskEmail(data.to)}`);
      return;
    }
    throw error;
  }
}

export async function dispatchEmail(jobName: string, data: EmailJobData): Promise<void> {
  if (!isMailjetConfigured && !isSmtpConfigured) {
    console.warn(`No email provider configured. Skipping job "${jobName}" for ${data.to}.`);
    return;
  }

  if (isMailjetConfigured) {
    await sendEmailViaMailjet(data);
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
      if (isMailjetConfigured) {
        await sendEmailViaMailjet(job.data);
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
