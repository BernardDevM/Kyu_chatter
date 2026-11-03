/** Three nodes, one mesh: the Kyu mark. Inherits colour from the parent. */
export function KyuMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 23 16 8l8 15H8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity=".4"
      />
      <circle cx="16" cy="7.5" r="4.5" fill="currentColor" />
      <circle cx="7.5" cy="23" r="4.5" fill="currentColor" />
      <circle cx="24.5" cy="23" r="4.5" fill="currentColor" />
    </svg>
  );
}
