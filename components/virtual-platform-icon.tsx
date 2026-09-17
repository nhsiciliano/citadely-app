import type { VirtualPlatform } from "@/lib/virtual-service";

export function VirtualPlatformIcon({ platform, className = "h-8 w-8" }: { platform: VirtualPlatform; className?: string }) {
  if (platform === "google_meet") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 32 32">
        <path d="M4 8.5A3.5 3.5 0 0 1 7.5 5h12A3.5 3.5 0 0 1 23 8.5v15a3.5 3.5 0 0 1-3.5 3.5h-12A3.5 3.5 0 0 1 4 23.5Z" fill="#fff" />
        <path d="M4 10h7l4-5H7.5A3.5 3.5 0 0 0 4 8.5Z" fill="#fbbc04" />
        <path d="M4 10h7v12H4Z" fill="#00ac47" />
        <path d="M4 22h7l4 5H7.5A3.5 3.5 0 0 1 4 23.5Z" fill="#ea4335" />
        <path d="M11 10h12v12H11Z" fill="#00832d" />
        <path d="m23 12 5-4v16l-5-4Z" fill="#00ac47" />
        <path d="M15 5h4.5A3.5 3.5 0 0 1 23 8.5V10h-8Z" fill="#ffba00" />
        <path d="M15 22h8v1.5a3.5 3.5 0 0 1-3.5 3.5H15Z" fill="#2684fc" />
      </svg>
    );
  }

  if (platform === "microsoft_teams") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 32 32">
        <circle cx="23.5" cy="8" r="4" fill="#7b83eb" />
        <path d="M18 13h9a3 3 0 0 1 3 3v6.5a5.5 5.5 0 0 1-11 0V14a1 1 0 0 1 1-1Z" fill="#6264a7" />
        <rect x="3" y="7" width="19" height="19" rx="3" fill="#5059c9" />
        <path d="M8 12h10v3h-3.4v8h-3.2v-8H8Z" fill="#fff" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#2d8cff" />
      <path d="M6.5 11.5A2.5 2.5 0 0 1 9 9h9a4 4 0 0 1 4 4v7.5A2.5 2.5 0 0 1 19.5 23H10a3.5 3.5 0 0 1-3.5-3.5Z" fill="#fff" />
      <path d="m22 14.2 4.1-3c.8-.6 1.9 0 1.9 1v7.6c0 1-1.1 1.6-1.9 1l-4.1-3Z" fill="#fff" />
    </svg>
  );
}
