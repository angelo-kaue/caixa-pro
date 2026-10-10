export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#22C55E" />
      <path d="M8 21.5 13.5 16l3.5 3.5L24 11.5" stroke="#050505" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.15rem] font-extrabold tracking-tight">
        Caixa<span className="text-brand">Pro</span>
      </span>
    </span>
  );
}
