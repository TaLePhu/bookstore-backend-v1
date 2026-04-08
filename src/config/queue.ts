import { Queue, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { getEnv } from './env';

const env = getEnv();

const connection = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
};

export const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false, // true for 465, false for other ports
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

export const emailQueue = new Queue('EmailQueue', { connection });

export interface EmailJobData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const emailWorker = new Worker(
  'EmailQueue',
  async (job: Job<EmailJobData>) => {
    const { to, subject, text, html } = job.data;
    try {
      const info = await transporter.sendMail({
        from: `"BookStore Server" <${env.smtp.user}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`Message sent: ${info.messageId}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
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
