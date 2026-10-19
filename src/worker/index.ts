import PgBoss from 'pg-boss';
import { missionClock } from './jobs/mission-clock';
import { sendPendingEmails } from './jobs/emails';
import { sendPendingPushes } from './jobs/push';
import { housekeeping, inspectionCheck } from './jobs/maintenance';
import { summariesDue } from './jobs/summaries';
import { db } from '../lib/db';

// Background worker. The job queue lives in PostgreSQL (pg-boss), so no extra service is needed.
// Each job is idempotent; if the worker is down for a while it simply catches up on its next run.

const TZ = 'Africa/Lagos';

const jobs: Array<{ name: string; cron: string; run: () => Promise<void> }> = [
  { name: 'mission-clock', cron: '* * * * *', run: () => missionClock() },
  { name: 'send-emails', cron: '* * * * *', run: () => sendPendingEmails() },
  { name: 'send-push', cron: '* * * * *', run: () => sendPendingPushes() },
  { name: 'summaries', cron: '*/5 * * * *', run: () => summariesDue() },
  { name: 'inspection-check', cron: '0 6 * * *', run: () => inspectionCheck() },
  { name: 'housekeeping', cron: '30 3 * * *', run: () => housekeeping() },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const boss = new PgBoss({ connectionString, schema: 'pgboss' });
  boss.on('error', (err) => console.error('[worker] pg-boss error', err));
  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(job.name, { name: job.name, policy: 'singleton', retryLimit: 2, retryDelay: 30, expireInSeconds: 600 });
    await boss.schedule(job.name, job.cron, {}, { tz: TZ });
    await boss.work(job.name, async () => {
      const started = Date.now();
      try {
        await job.run();
      } catch (err) {
        console.error(`[worker] ${job.name} failed`, err);
        throw err;
      } finally {
        const ms = Date.now() - started;
        if (ms > 5_000) console.log(`[worker] ${job.name} took ${ms} ms`);
      }
    });
  }
  console.log(`[worker] running ${jobs.length} scheduled jobs (${TZ})`);

  const shutdown = async () => {
    console.log('[worker] stopping');
    await boss.stop({ graceful: true, timeout: 20_000 });
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
