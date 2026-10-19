// The unit logo (set by Admin in Settings; the built-in crest otherwise).
export function Logo({ size = 32, version = 0, className = '' }: { size?: number; version?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/branding/logo?v=${version}`} alt="" width={size} height={size} style={{ width: size, height: size }} className={`shrink-0 object-contain ${className}`} />
  );
}

/** A faint copy of the watermark image fixed behind every page. */
export function Watermark({ version = 0 }: { version?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] bg-center bg-no-repeat opacity-[0.05] print:opacity-[0.08]"
      style={{ backgroundImage: `url(/api/branding/watermark?v=${version})`, backgroundSize: 'min(70vw, 560px)' }}
    />
  );
}
