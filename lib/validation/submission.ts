/**
 * CODE-e-MANIPAL 2.0 — Submission Schema & Anti-SSRF URL Validation
 *
 * Implements strict server-side validation and anti-SSRF protections
 * according to IMPLEMENTATION_BASELINE_v4_FINAL.md (Phase 4).
 *
 * Key protections:
 * 1. Passive storage only — portal never fetches, proxies, or scrapes URLs.
 * 2. Strict scheme allowlisting (https/http only; reject javascript:, data:, file:, ftp:).
 * 3. Rejection of private IP ranges, loopback, and local hostnames.
 * 4. Bounded length checks and category allowlist.
 * 5. Pre-flight finalization validation.
 */

import { OFFICIAL_TRACKS } from '@/lib/event/eventConstants';

export const ALLOWED_CATEGORIES = [
  // Official 9 Reconciled Code-e-Manipal 2.0 Tracks (lowercased)
  'ai/ml',
  'healthtech',
  'fintech/edtech',
  'cybersecurity',
  'generative ai & llms',
  'multi-agent systems',
  'gaming & immersive tech',
  'smart city and infrastructure',
  'open innovation',
  // Normalized slugs
  'ai-ml',
  'fintech-edtech',
  'genai-llms',
  'multi-agent',
  'gaming-immersive',
  'smart-city',
  // Backward-compatible legacy categories
  'web',
  'mobile',
  'blockchain',
  'iot',
  'game',
  'cloud',
  'other',
] as const;

export type SubmissionCategory = typeof ALLOWED_CATEGORIES[number];

/**
 * Checks whether an IP or hostname is private, internal, or loopback.
 */
function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Localhost names
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 Loopback
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) {
    return true;
  }

  // IPv4 0.0.0.0
  if (lower === '0.0.0.0') {
    return true;
  }

  // IPv4 Private Class A: 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) {
    return true;
  }

  // IPv4 Private Class B: 172.16.0.0/12 (172.16 - 172.31)
  const classBMatch = lower.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (classBMatch) {
    const secondOctet = parseInt(classBMatch[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  // IPv4 Private Class C: 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower)) {
    return true;
  }

  // IPv4 Link-local / Cloud Metadata: 169.254.0.0/16
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower)) {
    return true;
  }

  // IPv6 loopback / local
  if (
    lower === '::1' ||
    lower === '[::1]' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('[fe80:') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('[fc00:')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates a submitted external URL.
 * Strictly passive storage: rejects SSRF vectors, javascript:, data:, private IPs.
 */
export function validatePassiveUrl(urlStr: string | null | undefined): {
  valid: boolean;
  sanitized: string | null;
  error?: string;
} {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: true, sanitized: null };
  }

  const trimmed = urlStr.trim();
  if (trimmed === '') {
    return { valid: true, sanitized: null };
  }

  if (trimmed.length > 2000) {
    return { valid: false, sanitized: null, error: 'URL exceeds maximum length of 2000 characters.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, sanitized: null, error: 'Invalid URL format.' };
  }

  // Scheme must be strictly http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      sanitized: null,
      error: `Disallowed URL protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  // Anti-SSRF: check for private / internal / loopback hosts
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      valid: false,
      sanitized: null,
      error: 'URL cannot point to localhost, private IP ranges, or internal networks.',
    };
  }

  return { valid: true, sanitized: parsed.toString() };
}

/**
 * Validates GitHub repository URLs.
 */
export function validateGithubUrl(urlStr: string | null | undefined): {
  valid: boolean;
  sanitized: string | null;
  error?: string;
} {
  const baseValidation = validatePassiveUrl(urlStr);
  if (!baseValidation.valid || !baseValidation.sanitized) {
    return baseValidation;
  }

  try {
    const parsed = new URL(baseValidation.sanitized);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return {
        valid: false,
        sanitized: null,
        error: 'github_url must point to a valid github.com repository.',
      };
    }

    // Must have at least /owner/repo in pathname
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      return {
        valid: false,
        sanitized: null,
        error: 'github_url must include repository owner and name (e.g. https://github.com/owner/repo).',
      };
    }

    return { valid: true, sanitized: baseValidation.sanitized };
  } catch {
    return { valid: false, sanitized: null, error: 'Invalid GitHub URL format.' };
  }
}

export interface SubmissionInput {
  title?: string;
  summary?: string;
  category?: string;
  technologies?: string[];
  github_url?: string | null;
  demo_url?: string | null;
  docs_url?: string | null;
  demo_video_url?: string | null;
  tagline?: string | null;
  problem_solved?: string | null;
  architecture_overview?: string | null;
  technical_challenges?: string | null;
  what_worked_well?: string | null;
  challenges_faced?: string | null;
  lessons_learned?: string | null;
  future_roadmap?: string | null;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  data?: T;
}

/**
 * Validates submission creation payload.
 */
export function validateCreateSubmission(input: any): ValidationResult<SubmissionInput> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object.'] };
  }

  // 1. Title
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    errors.push('title is required.');
  } else if (title.length < 2 || title.length > 200) {
    errors.push('title must be between 2 and 200 characters.');
  }

  // 2. Summary
  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  if (!summary) {
    errors.push('summary is required.');
  } else if (summary.length < 10 || summary.length > 500) {
    errors.push('summary must be between 10 and 500 characters.');
  }

  // 3. Category
  const category = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
  if (!category) {
    errors.push('category is required.');
  } else if (!ALLOWED_CATEGORIES.includes(category as any)) {
    errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
  }

  // 4. Technologies
  let technologies: string[] = [];
  if (input.technologies !== undefined) {
    if (!Array.isArray(input.technologies)) {
      errors.push('technologies must be an array of strings.');
    } else {
      technologies = input.technologies
        .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        .map((t: string) => t.trim().slice(0, 50));
      if (technologies.length > 30) {
        errors.push('technologies cannot contain more than 30 items.');
      }
    }
  }

  // 5. URLs
  const githubRes = validateGithubUrl(input.github_url);
  if (!githubRes.valid) errors.push(githubRes.error || 'Invalid github_url.');

  const demoRes = validatePassiveUrl(input.demo_url);
  if (!demoRes.valid) errors.push(demoRes.error || 'Invalid demo_url.');

  const docsRes = validatePassiveUrl(input.docs_url);
  if (!docsRes.valid) errors.push(docsRes.error || 'Invalid docs_url.');

  const videoRes = validatePassiveUrl(input.demo_video_url || input.video_url || input.videoUrl);
  if (!videoRes.valid) errors.push(videoRes.error || 'Invalid demo_video_url.');

  // 6. Optional text fields
  const sanitizeText = (val: any, max: number, name: string): string | null => {
    if (val === undefined || val === null) return null;
    if (typeof val !== 'string') {
      errors.push(`${name} must be a string.`);
      return null;
    }
    const t = val.trim();
    if (t.length > max) {
      errors.push(`${name} exceeds maximum length of ${max} characters.`);
    }
    return t || null;
  };

  const tagline = sanitizeText(input.tagline, 200, 'tagline');
  const problem_solved = sanitizeText(input.problem_solved || input.problemSolved, 1500, 'problem_solved');
  const architecture_overview = sanitizeText(input.architecture_overview || input.architectureOverview, 3000, 'architecture_overview');
  const technical_challenges = sanitizeText(input.technical_challenges || input.technicalChallenges, 3000, 'technical_challenges');
  const what_worked_well = sanitizeText(input.what_worked_well || input.whatWorkedWell, 3000, 'what_worked_well');
  const challenges_faced = sanitizeText(input.challenges_faced || input.challengesFaced, 3000, 'challenges_faced');
  const lessons_learned = sanitizeText(input.lessons_learned || input.lessonsLearned, 3000, 'lessons_learned');
  const future_roadmap = sanitizeText(input.future_roadmap || input.futureRoadmap, 3000, 'future_roadmap');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      title,
      summary,
      category,
      technologies,
      github_url: githubRes.sanitized,
      demo_url: demoRes.sanitized,
      docs_url: docsRes.sanitized,
      demo_video_url: videoRes.sanitized,
      tagline,
      problem_solved,
      architecture_overview,
      technical_challenges,
      what_worked_well,
      challenges_faced,
      lessons_learned,
      future_roadmap,
    },
  };
}

/**
 * Validates submission update payload (partial).
 */
export function validateUpdateSubmission(input: any): ValidationResult<Partial<SubmissionInput>> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object.'] };
  }

  const updates: Partial<SubmissionInput> = {};

  if (input.title !== undefined) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length < 2 || title.length > 200) {
      errors.push('title must be between 2 and 200 characters.');
    } else {
      updates.title = title;
    }
  }

  if (input.summary !== undefined) {
    const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
    if (!summary || summary.length < 10 || summary.length > 500) {
      errors.push('summary must be between 10 and 500 characters.');
    } else {
      updates.summary = summary;
    }
  }

  if (input.category !== undefined) {
    const cat = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
    if (!ALLOWED_CATEGORIES.includes(cat as any)) {
      errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
    } else {
      updates.category = cat;
    }
  }

  if (input.technologies !== undefined) {
    if (!Array.isArray(input.technologies)) {
      errors.push('technologies must be an array of strings.');
    } else {
      const tech = input.technologies
        .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        .map((t: string) => t.trim().slice(0, 50));
      if (tech.length > 30) {
        errors.push('technologies cannot contain more than 30 items.');
      } else {
        updates.technologies = tech;
      }
    }
  }

  if (input.github_url !== undefined) {
    const githubRes = validateGithubUrl(input.github_url);
    if (!githubRes.valid) errors.push(githubRes.error || 'Invalid github_url.');
    else updates.github_url = githubRes.sanitized;
  }

  if (input.demo_url !== undefined) {
    const demoRes = validatePassiveUrl(input.demo_url);
    if (!demoRes.valid) errors.push(demoRes.error || 'Invalid demo_url.');
    else updates.demo_url = demoRes.sanitized;
  }

  if (input.docs_url !== undefined) {
    const docsRes = validatePassiveUrl(input.docs_url);
    if (!docsRes.valid) errors.push(docsRes.error || 'Invalid docs_url.');
    else updates.docs_url = docsRes.sanitized;
  }

  const rawVideo = input.demo_video_url !== undefined ? input.demo_video_url : (input.video_url !== undefined ? input.video_url : input.videoUrl);
  if (rawVideo !== undefined) {
    const videoRes = validatePassiveUrl(rawVideo);
    if (!videoRes.valid) errors.push(videoRes.error || 'Invalid demo_video_url.');
    else updates.demo_video_url = videoRes.sanitized;
  }

  const sanitizeText = (val: any, max: number, name: string): string | null => {
    if (val === null) return null;
    if (typeof val !== 'string') {
      errors.push(`${name} must be a string.`);
      return null;
    }
    const t = val.trim();
    if (t.length > max) {
      errors.push(`${name} exceeds maximum length of ${max} characters.`);
    }
    return t || null;
  };

  if (input.tagline !== undefined) updates.tagline = sanitizeText(input.tagline, 200, 'tagline');
  if (input.problem_solved !== undefined) updates.problem_solved = sanitizeText(input.problem_solved, 1500, 'problem_solved');
  if (input.architecture_overview !== undefined) updates.architecture_overview = sanitizeText(input.architecture_overview, 3000, 'architecture_overview');
  if (input.technical_challenges !== undefined) updates.technical_challenges = sanitizeText(input.technical_challenges, 3000, 'technical_challenges');
  if (input.what_worked_well !== undefined) updates.what_worked_well = sanitizeText(input.what_worked_well, 3000, 'what_worked_well');
  if (input.challenges_faced !== undefined) updates.challenges_faced = sanitizeText(input.challenges_faced, 3000, 'challenges_faced');
  if (input.lessons_learned !== undefined) updates.lessons_learned = sanitizeText(input.lessons_learned, 3000, 'lessons_learned');
  if (input.future_roadmap !== undefined) updates.future_roadmap = sanitizeText(input.future_roadmap, 3000, 'future_roadmap');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], data: updates };
}

/**
 * Pre-flight validation required before final submission locking.
 */
export function validateSubmissionForFinalize(submission: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!submission.title || submission.title.trim().length < 2) {
    errors.push('Submission title is required.');
  }

  if (!submission.summary || submission.summary.trim().length < 10) {
    errors.push('Submission summary is required (minimum 10 characters).');
  }

  if (!submission.category || !ALLOWED_CATEGORIES.includes(submission.category)) {
    errors.push(`A valid category is required (${ALLOWED_CATEGORIES.join(', ')}).`);
  }

  if (!submission.github_url || submission.github_url.trim().length === 0) {
    errors.push('github_url is required for final submission.');
  } else {
    const gitVal = validateGithubUrl(submission.github_url);
    if (!gitVal.valid) {
      errors.push(gitVal.error || 'Invalid github_url.');
    }
  }

  if (!Array.isArray(submission.technologies) || submission.technologies.length === 0) {
    errors.push('At least one technology must be listed.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
