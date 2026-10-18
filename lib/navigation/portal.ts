export type PortalRole = "participant" | "judge" | "admin";

export type NavigationItem = {
  name: string;
  link: string;
};

/**
 * The single source of truth for links shown by the authenticated portal shell.
 * Server-side guards remain responsible for granting access to each destination.
 */
const portalNavigation: Record<PortalRole, NavigationItem[]> = {
  participant: [
    { name: "Dashboard", link: "/dashboard" },
    { name: "Timeline", link: "/timeline" },
    { name: "Problem Statements", link: "/problem-statements" },
    { name: "Submit", link: "/submit" },
    { name: "Team", link: "/team" },
    { name: "Results", link: "/results" },
  ],
  judge: [
    { name: "Judge Workspace", link: "/judge" },
    { name: "Timeline", link: "/timeline" },
    { name: "Problem Statements", link: "/problem-statements" },
  ],
  admin: [
    { name: "Operations", link: "/admin" },
    { name: "Dashboard", link: "/dashboard" },
    { name: "Timeline", link: "/timeline" },
    { name: "Problem Statements", link: "/problem-statements" },
    { name: "Team", link: "/team" },
    { name: "Submit", link: "/submit" },
    { name: "Judge", link: "/judge" },
    { name: "Results", link: "/results" },
  ],
};

export function getPortalNavigation(role: string): NavigationItem[] {
  return portalNavigation[(role in portalNavigation ? role : "participant") as PortalRole];
}

import { isDemoMode } from '../demo/demoMode.ts';

export const publicNavigation: NavigationItem[] = [
  { name: "Home", link: "/" },
  { name: "Problem Statements", link: "/problem-statements" },
  { name: "Timeline", link: "/timeline" },
  { name: "FAQ", link: "/faq" },
];

export const demoPublicNavigation: NavigationItem[] = [
  { name: "Home", link: "/" },
  { name: "Problem Statements", link: "/problem-statements" },
  { name: "Timeline", link: "/timeline" },
  { name: "Results", link: "/results" },
  { name: "Guidelines", link: "/guidelines" },
  { name: "FAQ", link: "/faq" },
];

export function getPublicNavigation(): NavigationItem[] {
  if (isDemoMode()) {
    return demoPublicNavigation;
  }
  return publicNavigation;
}
