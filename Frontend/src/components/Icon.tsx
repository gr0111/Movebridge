import type { ReactNode } from "react";

export type IconName =
  | "search"
  | "arrow"
  | "chevron"
  | "calendar"
  | "clock"
  | "wallet"
  | "pin"
  | "play"
  | "bookmark"
  | "info"
  | "close"
  | "check"
  | "sliders"
  | "external"
  | "reset"
  | "grid"
  | "leaf"
  | "user"
  | "menu";
export default function Icon({
  name,
  size = 20,
  ...props
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15m-5-5 5 5-5 5" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    calendar: (
      <>
        <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
        <path d="M7.5 3v5m9-5v5m-13 3h17M8 15h2m4 0h2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M17 10h4v5h-4a2.5 2.5 0 0 1 0-5ZM4 5l13-2v2" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    play: <path d="m9 5 11 7-11 7Z" />,
    bookmark: <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4Z" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    sliders: (
      <>
        <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
    external: (
      <>
        <path d="M14 4h6v6m0-6-10 10m1-10H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4C9 2 3 7 5 14c3 9 17 5 15-10ZM5 21 16 9" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
