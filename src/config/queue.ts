import { Queue, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { getEnv } from './env';

const env = getEnv();

const connection = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  tls: env.redis.tls ? {} : undefined,
};

export const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  tls: {
    rejectUnauthorized: env.smtp.rejectUnauthorized,
  },
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

const EMAIL_QUEUE_NAME = 'email-queue';
const isSmtpConfigured = Boolean(env.smtp.user && env.smtp.pass);

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
    from: `"BookStore Server" <${env.smtp.user}>`,
    to,
    subject,
    text,
    html,
  });
  console.log(`Message sent: ${info.messageId}`);
}

export async function dispatchEmail(jobName: string, data: EmailJobData): Promise<void> {
  if (!isSmtpConfigured) {
    console.warn(`SMTP is not configured. Skipping job "${jobName}" for ${data.to}.`);
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
