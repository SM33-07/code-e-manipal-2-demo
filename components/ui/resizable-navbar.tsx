"use client";
import { cn } from "./utils";
import { Menu, X } from "lucide-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";

import React, { useRef, useState } from "react";
import Link from "next/link";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
  isSubmissionForm?: boolean;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
  isSubmissionForm?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
  }[];
  className?: string;
  onItemClick?: () => void;
  pathname?: string;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
  isSubmissionForm?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className, isSubmissionForm }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 50) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0 top-0 z-50 w-full flex flex-col items-center transition-all duration-300 pointer-events-none",
        visible ? "py-2 sm:py-2.5" : "py-3 sm:py-4",
        className
      )}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean; isSubmissionForm?: boolean }>,
              { visible, isSubmissionForm },
            )
          : child,
      )}
    </div>
  );
};

export const NavBody = ({ children, className, visible, isSubmissionForm }: NavBodyProps) => {
  return (
    <div
      className={cn(
        "relative z-[60] mx-auto hidden lg:flex w-[calc(100%-2rem)] flex-row items-center justify-between transition-all duration-300 pointer-events-auto",
        visible
          ? "max-w-6xl xl:max-w-7xl rounded-2xl bg-surface-elevated text-card-foreground px-5 xl:px-6 py-2 border border-border shadow-[0_8px_24px_rgba(36,33,29,0.12)]"
          : "max-w-7xl rounded-2xl bg-transparent text-foreground px-5 py-2.5 border border-transparent shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const NavItems = ({ items, className, onItemClick, pathname }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Responsive item slicing: show 5 primary items directly, overflow the rest cleanly into More.
  // This guarantees brand logo and status actions never collide across any screen width or zoom factor.
  const primaryCount = 5;
  const primaryItems = items.slice(0, primaryCount);
  const overflowItems = items.slice(primaryCount);

  return (
    <div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "flex min-w-0 flex-1 flex-row items-center justify-center gap-1 xl:gap-1.5 text-xs xl:text-sm font-medium transition duration-200 lg:flex",
        className,
      )}
    >
      {primaryItems.map((item, idx) => {
        const isActive = pathname === item.link || (item.link !== "/" && !!pathname?.startsWith(item.link));
        const isSubmit = item.link === "/submit";

        return (
          <Link
            onMouseEnter={() => setHovered(idx)}
            onClick={onItemClick}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-2.5 xl:px-3.5 py-1.5 transition-colors duration-150 rounded-lg inline-flex items-center text-xs xl:text-sm font-medium cursor-pointer shrink-0",
              isSubmit
                ? "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90"
                : isActive
                ? "text-primary font-semibold bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            key={`link-${idx}`}
            href={item.link}
          >
            <span className="relative z-20">{item.name}</span>
          </Link>
        );
      })}
      {overflowItems.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            More
          </button>
          {moreOpen && (
            <div role="menu" className="absolute right-0 top-full mt-2 min-w-44 rounded-xl border border-border bg-popover p-1.5 shadow-xl z-50">
              {overflowItems.map((item) => (
                <Link
                  key={item.link}
                  href={item.link}
                  role="menuitem"
                  onClick={() => { setMoreOpen(false); onItemClick?.(); }}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                    pathname === item.link ? "bg-accent text-primary font-semibold" : "text-popover-foreground"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const MobileNav = ({ children, className, visible, isSubmissionForm }: MobileNavProps) => {
  return (
    <div
      className={cn(
        "relative z-[60] mx-auto flex w-[calc(100%-1.5rem)] flex-row items-center justify-between rounded-xl bg-transparent text-foreground px-4 py-2 lg:hidden transition-all duration-300 border border-transparent shadow-none pointer-events-auto",
        visible && "bg-surface-elevated text-card-foreground border-border shadow-[0_8px_24px_rgba(36,33,29,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-3 rounded-xl bg-surface-elevated text-card-foreground px-6 py-6 shadow-lg border border-border",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  const Icon = isOpen ? X : Menu;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={isOpen}
      className="inline-flex size-10 items-center justify-center text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
};

export const NavbarLogo = () => {
  return (
    <Link
      href="/"
      className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-foreground"
    >
      <img
        src="/logo.png"
        alt="Code-e-Manipal 2.0"
        className="h-9 w-auto object-contain bg-transparent"
      />
    </Link>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  const baseStyles =
    "px-4 py-2 rounded-lg text-sm font-semibold relative cursor-pointer transition-colors inline-block text-center border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const variantStyles = {
    primary: "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/90 shadow-sm",
    dark: "bg-foreground text-background border-foreground hover:opacity-90",
    gradient: "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm",
  };

  return (
    <Tag
      href={href || undefined}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Tag>
  );
};
