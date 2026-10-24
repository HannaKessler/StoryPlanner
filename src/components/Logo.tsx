export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="sp-logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2a2118" />
      <circle cx="9" cy="16" r="2.3" fill="#e3a15a" />
      <circle cx="23" cy="8" r="2.2" fill="#f3eee6" />
      <circle cx="23" cy="16" r="2.2" fill="#f3eee6" />
      <circle cx="23" cy="24" r="2.2" fill="#f3eee6" />
      <path d="M11.2 16H16.2M16.2 16 20.8 8.4M16.2 16H20.8M16.2 16 20.8 23.6" stroke="#e3a15a" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
