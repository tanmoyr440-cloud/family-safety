import * as React from "react";
import { cn } from "@/shared/lib/utils";

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "full" | "icon";
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = "full",
  className,
  ...props
}) => {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)} {...props}>
      {/* Brand Vector Emblem */}
      <svg
        width="38"
        height="38"
        viewBox="0 0 38 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          {/* Main Shield Gradient */}
          <linearGradient id="fsn-shield-grad" x1="2" y1="2" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>

          {/* Core Accent Glow */}
          <linearGradient id="fsn-core-grad" x1="12" y1="12" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>

          {/* Subtle Shadow */}
          <filter id="fsn-shadow" x="0" y="2" width="38" height="38" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Shield Outer Container */}
        <rect
          x="2"
          y="2"
          width="34"
          height="34"
          rx="10"
          fill="url(#fsn-shield-grad)"
          filter="url(#fsn-shadow)"
        />

        {/* Shield Subtle Border Sheen */}
        <rect
          x="2.5"
          y="2.5"
          width="33"
          height="33"
          rx="9.5"
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth="1"
        />

        {/* Outer Protective Safety Net Arc */}
        <path
          d="M10 17C10 24 19 28.5 19 28.5C19 28.5 28 24 28 17V11.5L19 8.5L10 11.5V17Z"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interconnected Family Nodes (Safety Net) */}
        {/* Connection Arcs */}
        <path
          d="M19 12.5L13.5 22.5H24.5L19 12.5Z"
          stroke="white"
          strokeOpacity="0.9"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 12.5V20M13.5 22.5L19 20M24.5 22.5L19 20"
          stroke="white"
          strokeOpacity="0.75"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Safety Node 1: Top (Owner) */}
        <circle cx="19" cy="12.5" r="2.5" fill="white" />
        <circle cx="19" cy="12.5" r="1.25" fill="#2563EB" />

        {/* Safety Node 2: Bottom Left (Family Contact) */}
        <circle cx="13.5" cy="22.5" r="2.25" fill="white" />
        <circle cx="13.5" cy="22.5" r="1" fill="#4F46E5" />

        {/* Safety Node 3: Bottom Right (Family Contact) */}
        <circle cx="24.5" cy="22.5" r="2.25" fill="white" />
        <circle cx="24.5" cy="22.5" r="1" fill="#0891B2" />

        {/* Central Core Lock Node */}
        <circle cx="19" cy="20" r="1.5" fill="url(#fsn-core-grad)" />
      </svg>

      {/* Brand Logotype Typography (hidden in icon-only mode) */}
      {variant === "full" && (
        <div className="flex items-center text-[17px] tracking-tight leading-none">
          <span className="font-semibold text-slate-800">Family</span>
          <span className="font-extrabold text-blue-600 ml-1">Safety</span>
          <span className="font-extrabold text-slate-900">Net</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 ml-0.5 mb-1" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};
