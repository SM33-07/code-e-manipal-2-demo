"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && theme === "system") setTheme("light");
  }, [mounted, setTheme, theme]);

  if (!mounted) {
    return (
      <div
        className={`size-9 rounded-xl border border-border bg-card ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-[background-color,border-color,color,transform] duration-200 hover:border-secondary/70 hover:bg-accent hover:text-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none motion-reduce:transition-none ${className}`}
    >
      <Icon
        size={17}
        aria-hidden="true"
        className="transition-[transform,opacity] duration-200 motion-reduce:transition-none"
      />
    </button>
  );
}
