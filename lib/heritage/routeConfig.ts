/**
 * CODE-e-MANIPAL 2.0 — Authoritative Centralized Heritage Route Configuration
 *
 * Implements Section 13, 14, 15, 16, 17 of the Visual Overhaul Specification.
 *
 * Treatment Levels:
 * - LEVEL A (hero): Prominent architectural atmosphere with readability preserved
 * - LEVEL B (edge): Architectural framing / edge atmosphere, content primary
 * - LEVEL C (subtle): Restrained heritage texture / line
 * - LEVEL D (none): Solid operational surface (0% photography, pure technical console)
 *
 * Invariant: Runtime pages MUST NEVER reference `heritage/light-old` or `heritage/dark-old`.
 */

export type HeritageMode = "hero" | "edge" | "subtle" | "none";

export interface HeritageRouteThemeConfig {
  asset: string;
  position?: string;
  opacity?: number;
  overlay?: string;
}

export interface HeritageRouteConfig {
  light?: HeritageRouteThemeConfig;
  dark?: HeritageRouteThemeConfig;
  mode: HeritageMode;
}

export const HERITAGE_ROUTE_MAP: Record<string, HeritageRouteConfig> = {
  // Public & Participant Landing (Level A — Hero)
  "/": {
    mode: "hero",
    light: {
      asset: "/images/heritage/light/01-hawa-mahal-landscape.webp",
      position: "center center",
      opacity: 0.88,
    },
    dark: {
      asset: "/images/heritage/dark/08-pink-city-night.webp",
      position: "center 42%",
      opacity: 0.55,
    },
  },

  // Authentication Entry (Level A — Architectural Entrance)
  "/login": {
    mode: "hero",
    light: {
      asset: "/images/heritage/light/14-city-palace-ornate-hall.webp",
      position: "center center",
      opacity: 0.82,
    },
    dark: {
      asset: "/images/heritage/dark/03-sheesh-mahal-corridor.webp",
      position: "center center",
      opacity: 0.50,
    },
  },

  // Unified Participant Workspace (Level A — Hero / Environmental)
  "/dashboard": {
    mode: "hero",
    light: {
      asset: "/images/heritage/light/03-city-palace-courtyard.webp",
      position: "center center",
      opacity: 0.78,
    },
    dark: {
      asset: "/images/heritage/dark/04-nahargarh-sunset-city.webp",
      position: "center center",
      opacity: 0.48,
    },
  },

  // Hackathon Submission Console (Level B — Architectural Atmosphere)
  "/submit": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/14-city-palace-ornate-hall.webp",
      position: "center center",
      opacity: 0.70,
    },
    dark: {
      asset: "/images/heritage/dark/03-sheesh-mahal-corridor.webp",
      position: "center center",
      opacity: 0.45,
    },
  },
  "/SubmissionForm": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/14-city-palace-ornate-hall.webp",
      position: "center center",
      opacity: 0.70,
    },
    dark: {
      asset: "/images/heritage/dark/03-sheesh-mahal-corridor.webp",
      position: "center center",
      opacity: 0.45,
    },
  },

  // Travelling Timeline (Level B — Subtle Architectural / Technical)
  "/timeline": {
    mode: "subtle",
    light: {
      asset: "/images/heritage/light/10-samrat-yantra.webp",
      position: "center center",
      opacity: 0.65,
    },
    dark: {
      asset: "/images/heritage/dark/01-jantar-mantar-arch.webp",
      position: "center center",
      opacity: 0.40,
    },
  },

  // Problem Statements Gateway (Level B — Architectural Edge / Framed)
  "/problem-statements": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/09-jantar-mantar-gate.webp",
      position: "center center",
      opacity: 0.72,
    },
    dark: {
      asset: "/images/heritage/dark/01-jantar-mantar-arch.webp",
      position: "center center",
      opacity: 0.42,
    },
  },

  // Previous Editions Gallery (Level B — Architectural Edge)
  "/gallery": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/02-patrika-gate.webp",
      position: "center center",
      opacity: 0.68,
    },
    dark: {
      asset: "/images/heritage/dark/07-hawa-mahal-lit-night.webp",
      position: "center center",
      opacity: 0.45,
    },
  },

  // Public Results Ceremonial Page (Level A — Hero / Ceremonial)
  "/results": {
    mode: "hero",
    light: {
      asset: "/images/heritage/light/04-city-palace-exterior.webp",
      position: "center center",
      opacity: 0.75,
    },
    dark: {
      asset: "/images/heritage/dark/10-nahargarh-dome-city.webp",
      position: "center center",
      opacity: 0.50,
    },
  },
  "/submission-result": {
    mode: "hero",
    light: {
      asset: "/images/heritage/light/04-city-palace-exterior.webp",
      position: "center center",
      opacity: 0.75,
    },
    dark: {
      asset: "/images/heritage/dark/10-nahargarh-dome-city.webp",
      position: "center center",
      opacity: 0.50,
    },
  },

  // Judge Evaluation Workspace (Level B — Architectural Edge / Focused)
  "/judge": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/15-city-palace-hall-arches.webp",
      position: "center center",
      opacity: 0.65,
    },
    dark: {
      asset: "/images/heritage/dark/01-jantar-mantar-arch.webp",
      position: "center center",
      opacity: 0.38,
    },
  },
  "/judging": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/15-city-palace-hall-arches.webp",
      position: "center center",
      opacity: 0.65,
    },
    dark: {
      asset: "/images/heritage/dark/01-jantar-mantar-arch.webp",
      position: "center center",
      opacity: 0.38,
    },
  },

  // ── ADMIN OPERATIONS CONSOLE ──
  // Main Operations Overview (Subtle Heritage Atmosphere)
  "/admin": {
    mode: "subtle",
    light: {
      asset: "/images/heritage/light/04-city-palace-exterior.webp",
      position: "center center",
      opacity: 0.45,
    },
    dark: {
      asset: "/images/heritage/dark/09-albert-hall-night.webp",
      position: "center center",
      opacity: 0.28,
    },
  },
  "/admin/users": {
    mode: "none",
  },
  "/admin/teams": {
    mode: "none",
  },
  "/admin/submissions": {
    mode: "none",
  },
  "/admin/judging": {
    mode: "none",
  },
  "/admin/report": {
    mode: "none",
  },
  "/admin/analytics": {
    mode: "none",
  },
  "/admin/registrations": {
    mode: "none",
  },

  // Admin Event Control (Subtle heritage edge)
  "/admin/event": {
    mode: "subtle",
    light: {
      asset: "/images/heritage/light/11-zodiac-circle.webp",
      position: "center center",
      opacity: 0.40,
    },
    dark: {
      asset: "/images/heritage/dark/01-jantar-mantar-arch.webp",
      position: "center center",
      opacity: 0.25,
    },
  },
  "/admin/event-control": {
    mode: "subtle",
    light: {
      asset: "/images/heritage/light/11-zodiac-circle.webp",
      position: "center center",
      opacity: 0.40,
    },
    dark: {
      asset: "/images/heritage/dark/01-jantar-mantar-arch.webp",
      position: "center center",
      opacity: 0.25,
    },
  },

  // Admin Results Preparation (Subtle ceremonial atmosphere)
  "/admin/results": {
    mode: "subtle",
    light: {
      asset: "/images/heritage/light/15-city-palace-hall-arches.webp",
      position: "center center",
      opacity: 0.50,
    },
    dark: {
      asset: "/images/heritage/dark/09-albert-hall-night.webp",
      position: "center center",
      opacity: 0.30,
    },
  },

  // ── Auxiliary routes ──
  "/guidelines": {
    mode: "edge",
    light: {
      asset: "/images/heritage/light/05-amber-fort-courtyard.webp",
      position: "center center",
      opacity: 0.65,
    },
    dark: {
      asset: "/images/heritage/dark/02-sheesh-mahal-amber.webp",
      position: "center center",
      opacity: 0.35,
    },
  },
  "/faq": {
    mode: "subtle",
    light: {
      asset: "/images/heritage/light/08-albert-hall-day.webp",
      position: "center center",
      opacity: 0.55,
    },
    dark: {
      asset: "/images/heritage/dark/09-albert-hall-night.webp",
      position: "center center",
      opacity: 0.30,
    },
  },
};

/**
 * Resolves the HeritageRouteConfig for a given pathname.
 * Performs prefix matching for nested routes.
 */
export function getHeritageRouteConfig(pathname: string): HeritageRouteConfig {
  if (HERITAGE_ROUTE_MAP[pathname]) {
    return HERITAGE_ROUTE_MAP[pathname];
  }

  // Exact matching for common prefix trees
  if (pathname.startsWith("/admin/")) {
    const adminMatch = Object.keys(HERITAGE_ROUTE_MAP)
      .filter((k) => k.startsWith("/admin/") && pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (adminMatch) return HERITAGE_ROUTE_MAP[adminMatch];
    return { mode: "none" }; // Default admin routes: solid operational console
  }

  if (pathname.startsWith("/judge/") || pathname.startsWith("/judging/")) {
    return HERITAGE_ROUTE_MAP["/judge"];
  }

  if (pathname.startsWith("/submit") || pathname.startsWith("/SubmissionForm")) {
    return HERITAGE_ROUTE_MAP["/submit"];
  }

  if (pathname.startsWith("/project/") || pathname.startsWith("/gallery")) {
    return HERITAGE_ROUTE_MAP["/gallery"];
  }

  if (pathname.startsWith("/submission-result")) {
    return HERITAGE_ROUTE_MAP["/results"];
  }

  if (pathname.startsWith("/dashboard")) {
    return HERITAGE_ROUTE_MAP["/dashboard"];
  }

  // Fallback default: subtle atmosphere
  return {
    mode: "none",
  };
}
