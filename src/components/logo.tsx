export function Logo({ size = 56 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center rounded-[18px] bg-ink text-bg" style={{ width: size, height: size, borderRadius: size * 0.32 }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="15" r="1.2" fill="#FF5A36" stroke="#FF5A36" /></svg>
    </div>
  );
}
