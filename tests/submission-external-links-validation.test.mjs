/**
 * Tests: Submission External Links Validation
 * File: tests/submission-external-links-validation.test.mjs
 *
 * Verifies:
 * 1. Only Public GitHub / Code Repository is required.
 * 2. Presentation / Demo Video is optional.
 * 3. Documentation / Slides is optional.
 * 4. Submissions are accepted when both optional links are empty (""), null, or omitted.
 * 5. Provided URLs continue to be validated (valid scheme, format, anti-SSRF).
 * 6. Missing or invalid GitHub repository URLs are strictly rejected.
 * 7. Empty optional fields do not interfere with creating, updating, or finalizing submissions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateSubmission,
  validateUpdateSubmission,
  validateSubmissionForFinalize,
  validateGithubUrl,
  validatePassiveUrl,
} from '../lib/validation/submission.ts';

describe('Submission External Links Validation Suite', () => {
  const baseValidPayload = {
    title: 'Code e Manipal Portal',
    summary: 'A unified platform for managing hackathon judging and results.',
    category: 'ai/ml',
    technologies: ['Next.js', 'PostgreSQL', 'TypeScript'],
    tagline: 'Streamlining hackathon management',
    problem_solved: 'Inefficient judging and manual scoring.',
  };

  describe('1. validateCreateSubmission External Links Handling', () => {
    it('accepts payload when valid GitHub is provided and optional links are empty strings', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://github.com/learnit-muj/code-e-manipal',
        demo_url: '',
        docs_url: '',
        demo_video_url: '',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, true, `Expected valid payload, got errors: ${result.errors.join(', ')}`);
      assert.strictEqual(result.data.github_url, 'https://github.com/learnit-muj/code-e-manipal');
      assert.strictEqual(result.data.demo_url, null, 'Empty demo_url must sanitize to null');
      assert.strictEqual(result.data.docs_url, null, 'Empty docs_url must sanitize to null');
      assert.strictEqual(result.data.demo_video_url, null, 'Empty demo_video_url must sanitize to null');
    });

    it('accepts payload when valid GitHub is provided and optional links are omitted', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://github.com/org-name/repo-name',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.github_url, 'https://github.com/org-name/repo-name');
      assert.strictEqual(result.data.docs_url, null);
      assert.strictEqual(result.data.demo_video_url, null);
    });

    it('accepts payload when valid GitHub is provided and optional links are null', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://github.com/org-name/repo-name',
        demo_url: null,
        docs_url: null,
        demo_video_url: null,
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.github_url, 'https://github.com/org-name/repo-name');
      assert.strictEqual(result.data.docs_url, null);
      assert.strictEqual(result.data.demo_video_url, null);
    });

    it('accepts payload when all external links (GitHub + optional video & docs) are valid', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://github.com/facebook/react',
        demo_url: 'https://react.dev',
        docs_url: 'https://docs.google.com/presentation/d/12345/edit',
        demo_video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.github_url, 'https://github.com/facebook/react');
      assert.strictEqual(result.data.docs_url, 'https://docs.google.com/presentation/d/12345/edit');
      assert.strictEqual(result.data.demo_video_url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('rejects payload when github_url is missing', () => {
      const payload = {
        ...baseValidPayload,
        // github_url omitted
        demo_video_url: 'https://youtube.com/watch?v=123',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.includes('github_url is required')),
        `Expected "github_url is required" in errors: ${result.errors.join(', ')}`
      );
    });

    it('rejects payload when github_url is an empty string or whitespace', () => {
      const payload = {
        ...baseValidPayload,
        github_url: '   ',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('github_url is required')));
    });

    it('rejects payload when github_url does not point to github.com', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://gitlab.com/username/repository',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('must point to a valid github.com repository')));
    });

    it('rejects payload when github_url lacks repository path segments', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://github.com/onlyuser',
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('must include repository owner and name')));
    });

    it('rejects payload when github_url has invalid protocol or anti-SSRF violations', () => {
      const maliciousPayloads = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'http://127.0.0.1/repo',
        'http://localhost/repo',
        'http://192.168.1.1/owner/repo',
      ];

      for (const badUrl of maliciousPayloads) {
        const payload = {
          ...baseValidPayload,
          github_url: badUrl,
        };
        const result = validateCreateSubmission(payload);
        assert.strictEqual(result.valid, false, `Expected ${badUrl} to be rejected`);
      }
    });

    it('rejects payload when optional link has an invalid URL format or SSRF target', () => {
      const payload = {
        ...baseValidPayload,
        github_url: 'https://github.com/owner/valid-repo',
        demo_video_url: 'http://169.254.169.254/latest/meta-data', // AWS metadata SSRF
      };

      const result = validateCreateSubmission(payload);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('URL cannot point to localhost') || e.includes('demo_video_url')));
    });
  });

  describe('2. validateUpdateSubmission External Links Handling', () => {
    it('accepts updating with empty optional links, safely clearing them to null', () => {
      const updates = {
        docs_url: '',
        demo_video_url: '',
      };

      const result = validateUpdateSubmission(updates);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.docs_url, null, 'Updating with empty string should set docs_url to null');
      assert.strictEqual(result.data.demo_video_url, null, 'Updating with empty string should set demo_video_url to null');
    });

    it('accepts updating with valid github_url while omitting optional links', () => {
      const updates = {
        github_url: 'https://github.com/new-owner/new-repo',
      };

      const result = validateUpdateSubmission(updates);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.data.github_url, 'https://github.com/new-owner/new-repo');
      assert.strictEqual(result.data.docs_url, undefined, 'Omitted fields should remain undefined in update object');
    });

    it('rejects clearing github_url to an empty string during update', () => {
      const updates = {
        github_url: '',
      };

      const result = validateUpdateSubmission(updates);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('github_url cannot be empty')));
    });

    it('rejects updating github_url with a non-github repository URL', () => {
      const updates = {
        github_url: 'https://bitbucket.org/team/repo',
      };

      const result = validateUpdateSubmission(updates);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('must point to a valid github.com repository')));
    });
  });

  describe('3. validateSubmissionForFinalize Pre-flight Gate', () => {
    it('allows finalization when only github_url is provided and optional links are null', () => {
      const submission = {
        title: 'Complete Hackathon Project',
        summary: 'A complete and robust project summary satisfying requirements.',
        category: 'ai/ml',
        technologies: ['React', 'Node.js'],
        github_url: 'https://github.com/test-team/final-project',
        demo_video_url: null,
        docs_url: null,
      };

      const result = validateSubmissionForFinalize(submission);
      assert.strictEqual(result.valid, true, `Finalization must pass without optional links: ${result.errors.join(', ')}`);
    });

    it('rejects finalization when github_url is missing or empty', () => {
      const submission = {
        title: 'Complete Hackathon Project',
        summary: 'A complete and robust project summary satisfying requirements.',
        category: 'ai/ml',
        technologies: ['React', 'Node.js'],
        github_url: '',
      };

      const result = validateSubmissionForFinalize(submission);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('github_url is required')));
    });

    it('rejects finalization when github_url is invalid', () => {
      const submission = {
        title: 'Complete Hackathon Project',
        summary: 'A complete and robust project summary satisfying requirements.',
        category: 'ai/ml',
        technologies: ['React', 'Node.js'],
        github_url: 'https://notgithub.com/owner/repo',
      };

      const result = validateSubmissionForFinalize(submission);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('github_url must point to a valid github.com repository')));
    });
  });
});
