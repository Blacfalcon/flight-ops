/** The address people write to about their data. Set PRIVACY_EMAIL in .env for each unit's copy. */
export function privacyContact(): string {
  return process.env.PRIVACY_EMAIL || 'privacy@example.com';
}
