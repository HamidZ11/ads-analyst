/** The Ad Analyst mark used across the marketing site. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="currentColor" />
      <path
        d="M6 16.5 10.2 12l3 2.6L18 8.5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
