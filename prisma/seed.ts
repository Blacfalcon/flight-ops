/**
 * Seed: runs on every web container start and is safe to repeat.
 * - Makes the audit log append-only at the database level.
 * - Creates the first Admin from SEED_ADMIN_* variables if no Admin exists.
 * Aircraft, people and settings are entered through the app afterwards.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { splitName } from '../src/lib/names';

const db = new PrismaClient();

async function auditAppendOnly() {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION audit_log_block_change() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_log is append-only';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;`);
  await db.$executeRawUnsafe(`
    CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_block_change();
  `);
}

async function firstAdmin() {
  const existing = await db.user.count({ where: { appointment: 'ADMIN' } });
  if (existing > 0) return;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[seed] No Admin exists and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set. Skipping.');
    return;
  }
  const rank = (process.env.SEED_ADMIN_RANK ?? 'Squadron Leader').toUpperCase().replace(/\s+/g, '_');
  const user = await db.user.create({
    data: {
      rank: rank as never,
      fullName: process.env.SEED_ADMIN_NAME ?? 'System Administrator',
      ...splitName(process.env.SEED_ADMIN_NAME ?? 'System Administrator'),
      nafNumber: (process.env.SEED_ADMIN_NAF ?? 'SVC/0000').toUpperCase(),
      email: email.toLowerCase(),
      phone: process.env.SEED_ADMIN_PHONE ?? '+2340000000000',
      appointment: 'ADMIN',
      flightStatus: 'NONE',
      pilotCategory: 'NIL',
      passwordHash: await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
      emailVerifiedAt: new Date(),
      accountStatus: 'ACTIVE',
    },
  });
  await db.auditLog.create({ data: { actorId: null, action: 'seed.firstAdmin', entityType: 'user', entityId: user.id } });
  console.log(`[seed] Created first Admin ${email}. Sign in and change the password; two-step sign-in will be required.`);
}

async function main() {
  await auditAppendOnly();
  await firstAdmin();
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
