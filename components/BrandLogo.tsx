"use client";

import Link from "next/link";
import Image from "next/image";

interface BrandLogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  badge?: string;
  className?: string;
}

export function BrandLogo({
  href = "/",
  size = "md",
  subtitle,
  badge,
  className = "",
}: BrandLogoProps) {
  const logoHeights = {
    sm: "h-7 sm:h-8",
    md: "h-8 sm:h-[38px]",
    lg: "h-10 sm:h-11",
  }[size];

  const content = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official Brand Lockup (full aspect ratio, transparent background, zero white box on dark mode) */}
      <div className="relative flex items-center shrink-0">
        <div className="flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.02]">
          <Image
            src="/logo.png"
            alt="Code-e-Manipal 2.0"
            width={160}
            height={68}
            className={`${logoHeights} w-auto object-contain bg-transparent transition-opacity hover:opacity-90 dark:brightness-110`}
            priority
          />
        </div>
      </div>

      {(badge || subtitle) && (
        <div className="hidden sm:flex flex-col justify-center leading-tight">
          {badge && (
            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 uppercase tracking-wider self-start">
              {badge}
            </span>
          )}
          {subtitle && (
            <span className="text-[10px] text-muted-foreground tracking-wide truncate max-w-[200px] mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="group inline-flex items-center no-underline focus:outline-none shrink-0">
      {content}
    </Link>
  );
}
