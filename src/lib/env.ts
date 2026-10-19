// Central, lazily-checked access to environment variables.
// Values are read on first use so `next build` does not fail when secrets are absent at build time.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') throw new Error(`Missing environment variable ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  },
  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
  get jwtSecret() {
    return new TextEncoder().encode(required('JWT_SECRET'));
  },
  get dataKey() {
    return required('DATA_ENCRYPTION_KEY');
  },
  get accessTokenMinutes() {
    return num('ACCESS_TOKEN_MINUTES', 15);
  },
  get refreshTokenDays() {
    return num('REFRESH_TOKEN_DAYS', 7);
  },
  get idleTimeoutMinutes() {
    return num('IDLE_TIMEOUT_MINUTES', 30);
  },
  smtp() {
    return {
      host: required('SMTP_HOST'),
      port: num('SMTP_PORT', 465),
      secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
      user: required('SMTP_USER'),
      pass: required('SMTP_PASS'),
      from: process.env.MAIL_FROM ?? required('SMTP_USER'),
    };
  },
  s3() {
    return {
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: required('S3_BUCKET'),
      accessKeyId: required('S3_ACCESS_KEY'),
      secretAccessKey: required('S3_SECRET_KEY'),
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    };
  },
};
