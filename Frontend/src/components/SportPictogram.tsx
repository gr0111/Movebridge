import type { ReactNode } from "react";
import type { SportIconKey } from "../data/course-sport";

const pictograms: Record<SportIconKey, ReactNode> = {
  billiards: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="m4 2 10 8" />
      <circle cx="7" cy="15" r="2" />
      <circle cx="12" cy="16" r="2" />
      <circle cx="18" cy="12" r="2" />
    </>
  ),
  aerobics: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m4 5 5 5 5-2 5 5m-9-3 3 5-5 6m5-6 6 5" />
    </>
  ),
  latin: (
    <>
      <circle cx="7" cy="4" r="1.7" />
      <circle cx="17" cy="6" r="1.7" />
      <path d="m3 9 5-1 5 3 5-1 3-3M8 8l-2 7-3 6m3-6 5 5m6-10-2 6 5 4m-5-4-3 6" />
    </>
  ),
  ballroom: (
    <>
      <circle cx="8" cy="4" r="1.7" />
      <circle cx="16" cy="4" r="1.7" />
      <path d="M3 9h6l5 2 6-3M8 9v7l-3 6m3-6 4 6m4-13-3 9h8l-5-9m1 9v4" />
    </>
  ),
  "line-dance": (
    <>
      <circle cx="6" cy="5" r="1.5" />
      <circle cx="18" cy="5" r="1.5" />
      <path d="M2 10h8m4 0h8M6 8v7l-3 5m3-5 3 5m9-12v7l-3 5m3-5 3 5M4 23h4m8 0h4" />
    </>
  ),
  horse: (
    <>
      <path d="M6 21c0-4 1-7 4-10l-4 1-3-3 5-5 2-2 2 3 4-2v5c3 2 4 6 4 13Z" />
      <path d="M16 8c-3 0-4 2-4 5v8M4 9h2" />
      <circle cx="9" cy="7" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  badminton: (
    <>
      <ellipse cx="7" cy="8" rx="4.5" ry="6" transform="rotate(-30 7 8)" />
      <path d="m9 13 5 8M4 5l5 7m-6-3 7-3m6 7 5-8m-4 9 6-2-2-7-6 5Z" />
      <path d="m16 12 5-5" />
    </>
  ),
  "table-tennis": (
    <>
      <path d="M13 4c4 3 4 8 1 11l-5 1-5-5C3 6 8 1 13 4Zm-4 12-4 6-3-2 4-6m0-8 9 8" />
      <circle cx="20" cy="5" r="2" />
    </>
  ),
  tennis: (
    <>
      <ellipse cx="8" cy="8" rx="5" ry="6.5" transform="rotate(-35 8 8)" />
      <path d="m11 14 6 8M5 4l6 8M3 8l9-3M6 13l7-5" />
      <circle cx="20" cy="14" r="3" />
      <path d="M18 12c2 1 3 2 3 4" />
    </>
  ),
  pilates: (
    <>
      <circle cx="4" cy="15" r="2" />
      <path d="m6 16 6-4 5 4h5M12 12l5-8m-5 8 8-5M2 22h20" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.5 5.5c8 1 12 5 13 13M18.5 5.5c-8 1-12 5-13 13" />
    </>
  ),
  golf: (
    <>
      <path d="M5 18V3l9 4-9 4m12-8-3 16h6l1-3h-6M2 22h19" />
      <circle cx="9" cy="19" r="1" />
    </>
  ),
  kendo: (
    <>
      <path d="m3 2 17 17m1-17L4 19M3 15l6 6m6-6 6 6M2 22l3-3m14 0 3 3M2 2h3m14 0h3" />
    </>
  ),
  gym: (
    <>
      <path d="M8 12h8M3 9v6m18-6v6" />
      <rect x="5" y="6" width="3" height="12" rx="1" />
      <rect x="16" y="6" width="3" height="12" rx="1" />
    </>
  ),
  yoga: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M12 8v6m0-4L5 7m7 3 7-3m-7 7-5 4H3l4 3h10l4-3h-4Z" />
    </>
  ),
  posture: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M12 8v8m-5-5 5-3 5 3m-5 5-4 6m4-6 4 6M3 3v18m-1-9h2m17-9v18m-1-9h2" />
    </>
  ),
  "body-slim": (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="m5 7 4 3-1 5 4 2 4-2-1-5 4-3m-7 10-4 5m4-5 4 5M5 13l-3 2m17-2 3 2" />
    </>
  ),
  strength: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="m5 10 7 2 7-2M12 12v4l-5 6m5-6 5 6M3 6v7m-2-5v3m20-5v7m2-5v3M3 9h3m12 0h3" />
    </>
  ),
  cycling: (
    <>
      <circle cx="5" cy="16" r="4" />
      <circle cx="19" cy="16" r="4" />
      <path d="m5 16 5-9 5 9H5m10 0 3-11h3M8 7h5m-5-4h3" />
    </>
  ),
  zumba: (
    <>
      <circle cx="13" cy="5" r="2" />
      <path d="m3 4 5 7 5-2 5-6m-5 6-2 7-6 5m6-5 7 5m1-11 3 2M2 14l3-1" />
    </>
  ),
  "dance-sport": (
    <>
      <circle cx="7" cy="4" r="1.5" />
      <circle cx="17" cy="4" r="1.5" />
      <path d="m2 8 5 3 5-3 5 3 5-3M7 11l-2 5 4 5m-4-5-3 5m15-10 3 6h-7Zm0 6v5" />
    </>
  ),
  swimming: (
    <>
      <circle cx="17" cy="6" r="2" />
      <path d="m3 11 6-7 5 5-5 4M2 16q2.5 3 5 0t5 0 5 0 5 0M2 21q2.5 3 5 0t5 0 5 0 5 0" />
    </>
  ),
  activity: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m4 10 5 1 4-3 4 4 4-1m-8-3-2 8-6 5m6-5 6 5" />
    </>
  ),
};

export default function SportPictogram({ icon, size = 32 }: { icon: SportIconKey; size?: number }) {
  return (
    <svg
      className="sport-pictogram"
      data-sport-icon={icon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {pictograms[icon] || pictograms.activity}
    </svg>
  );
}
