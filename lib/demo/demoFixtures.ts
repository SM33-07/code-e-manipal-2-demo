/**
 * Synthetic Demo Data Fixtures for Public Portfolio Demonstration
 * File: lib/demo/demoFixtures.ts
 *
 * Provides completely sanitized, synthetic showcase records:
 * 1. Event configuration (concluded event in published results state)
 * 2. Leaderboard ranked results (10 sanitized finalist teams across 9 tracks)
 * 3. 35 official challenge briefs from data/final_35_problem_statements.json
 * 4. Timeline schedule entries for all phases
 * 5. Sanitized project showcases from data/projects.ts
 *
 * Zero real participant names, emails, credentials, or private submissions are included.
 */

import rawFinal35 from '@/data/final_35_problem_statements.json';
import { projects, type Project } from '@/data/projects';
import type { PublicEventConfig } from '@/lib/event/eventConfigHelper';
import type { PublicProblemStatementsResponse, PublicProblemStatement } from '@/services/problemStatementService';
import type { TimelineEventRecord } from '@/services/timelineService';

/**
 * Public Event Configuration for Demo Mode
 */
export const DEMO_EVENT_CONFIG: PublicEventConfig = {
  event_phase: 'RESULTS',
  results_release: 'PUBLISHED',
  start_time: '2026-10-14T03:30:00.000Z',
  end_time: '2026-10-15T09:30:00.000Z',
  publish_at: '2026-10-15T10:00:00.000Z',
  countdown_target: null,
  announcements: [
    {
      id: 'demo-announcement-1',
      title: 'Grand Finale Showcase Live',
      content: 'Welcome to the Code-e-Manipal 2.0 public portfolio demonstration. Explore 35 technical challenge briefs, event timeline, and verified jury evaluations.',
      priority: 'info',
      created_at: '2026-10-15T10:00:00.000Z',
    },
    {
      id: 'demo-announcement-2',
      title: 'Leaderboard & Evaluation Scores Published',
      content: 'Final verified results and rubric breakdowns across all 9 competition tracks are now publicly accessible.',
      priority: 'success',
      created_at: '2026-10-15T10:05:00.000Z',
    },
  ],
  active_round: 'Grand Finale',
  problem_statements_published: true,
  submission_open: false,
  allow_deadline_override: false,
  global_freeze: true,
  submission_window_status: 'CLOSED_BY_DEADLINE',
  is_submission_open: false,
  server_time: new Date().toISOString(),
};

/**
 * Sanitized Top 10 Ranked Results for Public Leaderboard Showcase
 */
export const DEMO_RANKED_RESULTS = [
  {
    id: 'demo-sub-01',
    title: 'ArcSense: Real-Time Early Warning for Unstable Weld Signatures',
    summary: 'Edge-deployed acoustic and electrical signature analyzer predicting welding defects using spectral anomaly detection.',
    category: 'AI/ML & Earth Observation',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:45:00.000Z',
    team_id: 'demo-team-01',
    team_name: 'Team NeuralPulse',
    computed: {
      avg_innovation: 9.8,
      avg_technical: 9.6,
      avg_presentation: 9.5,
      avg_impact: 9.7,
      total_score: 96.5,
      review_count: 5,
      rank: 1,
    },
  },
  {
    id: 'demo-sub-02',
    title: 'SafeDose: Automated Pediatric Dosing Verification Protocol',
    summary: 'Clinical decision-support aid integrating age-weight biometric normalization and real-time contraindication guards.',
    category: 'HealthTech',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:50:00.000Z',
    team_id: 'demo-team-02',
    team_name: 'Team MedVanguard',
    computed: {
      avg_innovation: 9.5,
      avg_technical: 9.5,
      avg_presentation: 9.4,
      avg_impact: 9.5,
      total_score: 94.8,
      review_count: 5,
      rank: 2,
    },
  },
  {
    id: 'demo-sub-03',
    title: 'ZeroTrust Mesh: Hardware Microsegmentation for Legacy SCADA',
    summary: 'Cryptographic perimeter guard for industrial control systems using eBPF packet filtering and mutual TLS tunnels.',
    category: 'Cybersecurity',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:30:00.000Z',
    team_id: 'demo-team-03',
    team_name: 'Team CyberShield',
    computed: {
      avg_innovation: 9.2,
      avg_technical: 9.4,
      avg_presentation: 9.1,
      avg_impact: 9.3,
      total_score: 92.4,
      review_count: 5,
      rank: 3,
    },
  },
  {
    id: 'demo-sub-04',
    title: 'FarmPulse: Autonomous Multispectral Soil Nutrient Mapping',
    summary: 'Low-cost UAV sensor array and offline computer vision pipeline estimating nitrogen-phosphorus-potassium distribution.',
    category: 'AI/ML & Earth Observation',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:15:00.000Z',
    team_id: 'demo-team-04',
    team_name: 'Team AgriSense',
    computed: {
      avg_innovation: 9.0,
      avg_technical: 9.1,
      avg_presentation: 9.0,
      avg_impact: 9.0,
      total_score: 90.1,
      review_count: 5,
      rank: 4,
    },
  },
  {
    id: 'demo-sub-05',
    title: 'OmniLearn: Multimodal Adaptive Curriculum Engine for Neurodiverse Learners',
    summary: 'Dynamic sensory adaptation interface converting technical documentation into high-comprehension visual diagrams.',
    category: 'FinTech / EdTech / LegalTech',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:20:00.000Z',
    team_id: 'demo-team-05',
    team_name: 'Team EduFlow',
    computed: {
      avg_innovation: 8.9,
      avg_technical: 8.8,
      avg_presentation: 9.0,
      avg_impact: 8.8,
      total_score: 88.7,
      review_count: 5,
      rank: 5,
    },
  },
  {
    id: 'demo-sub-06',
    title: 'ResilientGrid: Distributed Frequency Stabilizer for Urban Solar Rooftops',
    summary: 'Peer-to-peer microgrid coordination protocol balancing phase loads across distributed residential battery banks.',
    category: 'Smart City & Infrastructure',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:10:00.000Z',
    team_id: 'demo-team-06',
    team_name: 'Team GridSync',
    computed: {
      avg_innovation: 8.7,
      avg_technical: 8.8,
      avg_presentation: 8.7,
      avg_impact: 8.7,
      total_score: 87.2,
      review_count: 5,
      rank: 6,
    },
  },
  {
    id: 'demo-sub-07',
    title: 'SwarmOps: Decentralized Drone Swarm for Disaster Search & Rescue',
    summary: 'Consensus-based multi-agent exploration system operating over ad-hoc mesh radios in GPS-denied environments.',
    category: 'Multi-Agent Systems / Logistics',
    status: 'SUBMITTED',
    created_at: '2026-10-15T08:05:00.000Z',
    team_id: 'demo-team-07',
    team_name: 'Team AgentCraft',
    computed: {
      avg_innovation: 8.6,
      avg_technical: 8.7,
      avg_presentation: 8.5,
      avg_impact: 8.6,
      total_score: 86.0,
      review_count: 5,
      rank: 7,
    },
  },
  {
    id: 'demo-sub-08',
    title: 'CarbonLedger: Zero-Knowledge Supply Chain Scope-3 Emission Audits',
    summary: 'Verifiable cryptographic pipeline for cross-border carbon accounting preserving proprietary trade secrets.',
    category: 'Open Innovation in Hardware',
    status: 'SUBMITTED',
    created_at: '2026-10-15T07:55:00.000Z',
    team_id: 'demo-team-08',
    team_name: 'Team GreenTrace',
    computed: {
      avg_innovation: 8.5,
      avg_technical: 8.5,
      avg_presentation: 8.4,
      avg_impact: 8.5,
      total_score: 84.5,
      review_count: 5,
      rank: 8,
    },
  },
  {
    id: 'demo-sub-09',
    title: 'SurgicalXR: Sub-Millimeter Haptic-Feedback Telepresence Simulator',
    summary: 'Stereoscopic spatial computing interface enabling distributed surgical residency training with low-latency haptics.',
    category: 'Gaming & Immersive Tech',
    status: 'SUBMITTED',
    created_at: '2026-10-15T07:50:00.000Z',
    team_id: 'demo-team-09',
    team_name: 'Team ImmersiSim',
    computed: {
      avg_innovation: 8.4,
      avg_technical: 8.3,
      avg_presentation: 8.4,
      avg_impact: 8.2,
      total_score: 83.1,
      review_count: 5,
      rank: 9,
    },
  },
  {
    id: 'demo-sub-10',
    title: 'NyayaAI: Multilingual Vernacular Legal Precedent Synthesizer',
    summary: 'Domain-tuned retrieval-augmented generation engine mapping high court rulings into vernacular actionable summaries.',
    category: 'Generative AI & LLM Systems',
    status: 'SUBMITTED',
    created_at: '2026-10-15T07:45:00.000Z',
    team_id: 'demo-team-10',
    team_name: 'Team DeepLex',
    computed: {
      avg_innovation: 8.2,
      avg_technical: 8.2,
      avg_presentation: 8.3,
      avg_impact: 8.1,
      total_score: 81.9,
      review_count: 5,
      rank: 10,
    },
  },
];

/**
 * Returns all 35 approved problem statements loaded from verified JSON fixtures.
 */
export function getSyntheticDemoProblemStatements(): PublicProblemStatementsResponse {
  const rawList = Array.isArray(rawFinal35) ? rawFinal35 : [];

  const statements: PublicProblemStatement[] = rawList.map((d: any) => ({
    id: d.proposed_id || `PS ${String(d.challenge_num).padStart(2, '0')}`,
    challenge_num: d.challenge_num,
    track_num: d.track_num,
    track: d.track,
    original_ref_id: d.original_ref_id,
    slug: d.slug,
    title: d.title,
    difficulty: d.difficulty,
    build_type: d.build_type,
    is_official_sih: Boolean(d.is_official_sih),
    scope_note: d.scope_note,
    problem_statement: d.problem_statement,
    description_implementation: d.description_implementation || d.implementation_challenge,
    description_bullets: Array.isArray(d.description_bullets) ? d.description_bullets : [],
    deliverables: d.deliverables || d.minimum_acceptable_prototype,
    deliverables_bullets: Array.isArray(d.deliverables_bullets) ? d.deliverables_bullets : [],
    implementation_challenge: d.implementation_challenge,
    minimum_acceptable_prototype: d.minimum_acceptable_prototype,
    evaluation_tests: d.evaluation_tests,
    stretch_differentiator: d.stretch_differentiator,
    suggested_public_sector_relevance: d.suggested_public_sector_relevance,
    additional_guidance: d.additional_guidance || {},
    display_order: d.display_order ?? d.challenge_num,
  }));

  const tracks = Array.from(new Set(statements.map((s) => s.track))).filter(Boolean);

  return {
    isPublished: true,
    release: {
      version: 2,
      label: 'Final Event Release — 35 Shortlisted Challenges',
      published_at: '2026-10-14T03:30:00.000Z',
    },
    statements,
    tracks,
  };
}

/**
 * Synthetic Timeline Events for Demo Mode
 */
export function getDemoTimeline(): {
  events: TimelineEventRecord[];
  serverTime: string;
  config: { is_published: boolean; published_at: string | null; published_version: number };
} {
  const events: TimelineEventRecord[] = [
    // ── Day 1 (15 October 2026) — Authoritative Offline Grand Finale ──
    {
      id: 'demo-tl-d1-1',
      title: 'Registration Open',
      day_label: 'DAY 1',
      time_range: '9:00 AM – 11:00 AM',
      start_time: '9:00 AM',
      end_time: '11:00 AM',
      start_timestamp: '2026-10-15T03:30:00.000Z',
      end_timestamp: '2026-10-15T05:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'AB1',
      description: 'Participant check-in, registration kit distribution, Wi-Fi configuration, and workstation table allocation at AB1.',
      card_position: 'left',
      display_order: 1,
      status: 'completed',
      event_type: 'hospitality',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-15T05:30:00.000Z',
    },
    {
      id: 'demo-tl-d1-2',
      title: 'Opening Ceremony',
      day_label: 'DAY 1',
      time_range: '11:00 AM – 1:00 PM',
      start_time: '11:00 AM',
      end_time: '1:00 PM',
      start_timestamp: '2026-10-15T05:30:00.000Z',
      end_timestamp: '2026-10-15T07:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Vasanti Pai',
      description: 'Grand opening ceremony, keynote address by university leadership and partners, followed by introduction of mentors and jury.',
      card_position: 'right',
      display_order: 2,
      status: 'completed',
      event_type: 'ceremony',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-15T07:30:00.000Z',
    },
    {
      id: 'demo-tl-d1-3',
      title: 'Lunch',
      day_label: 'DAY 1',
      time_range: '1:00 PM – 2:30 PM',
      start_time: '1:00 PM',
      end_time: '2:30 PM',
      start_timestamp: '2026-10-15T07:30:00.000Z',
      end_timestamp: '2026-10-15T09:00:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Old Mess, AB1',
      description: 'Buffet lunch provided for all registered participants, mentors, and organizing staff at Old Mess, AB1.',
      card_position: 'left',
      display_order: 3,
      status: 'completed',
      event_type: 'hospitality',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-15T09:00:00.000Z',
    },
    {
      id: 'demo-tl-d1-4',
      title: 'Project Making',
      day_label: 'DAY 1',
      time_range: '2:00 PM – 7:00 PM',
      start_time: '2:00 PM',
      end_time: '7:00 PM',
      start_timestamp: '2026-10-15T08:30:00.000Z',
      end_timestamp: '2026-10-15T13:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Team Workstations',
      description: 'Problem statement closes at 4:00 PM. 36-hour sprint development commences across all project tracks.',
      card_position: 'right',
      display_order: 4,
      status: 'completed',
      event_type: 'hack',
      is_published: true,
      opens_submissions: true,
      closes_submissions: false,
      reminders_enabled: true,
      reminder_offsets_minutes: [15],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-15T13:30:00.000Z',
    },
    {
      id: 'demo-tl-d1-5',
      title: 'Dinner',
      day_label: 'DAY 1',
      time_range: '8:00 PM – 9:30 PM',
      start_time: '8:00 PM',
      end_time: '9:30 PM',
      start_timestamp: '2026-10-15T14:30:00.000Z',
      end_timestamp: '2026-10-15T16:00:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Old Mess, AB1',
      description: 'Dinner service at Old Mess, AB1. Midnight caffeine and refreshment stations open throughout the night.',
      card_position: 'left',
      display_order: 5,
      status: 'completed',
      event_type: 'hospitality',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-15T16:00:00.000Z',
    },

    // ── Day 2 (16 October 2026) — Authoritative Offline Grand Finale ──
    {
      id: 'demo-tl-d2-1',
      title: 'Judging Round 2',
      day_label: 'DAY 2',
      time_range: '6:00 AM – 7:30 AM',
      start_time: '6:00 AM',
      end_time: '7:30 AM',
      start_timestamp: '2026-10-16T00:30:00.000Z',
      end_timestamp: '2026-10-16T02:00:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Team Workstations',
      description: 'Results at 7:30 AM. Evaluation of project prototype progress, system architecture, and tech stack execution.',
      card_position: 'right',
      display_order: 6,
      status: 'completed',
      event_type: 'eval',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-16T02:00:00.000Z',
    },
    {
      id: 'demo-tl-d2-2',
      title: 'Breakfast',
      day_label: 'DAY 2',
      time_range: '8:00 AM – 9:30 AM',
      start_time: '8:00 AM',
      end_time: '9:30 AM',
      start_timestamp: '2026-10-16T02:30:00.000Z',
      end_timestamp: '2026-10-16T04:00:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Old Mess, AB1',
      description: 'Breakfast service at Old Mess, AB1. Final presentation prep and polish before afternoon demonstrations.',
      card_position: 'left',
      display_order: 7,
      status: 'completed',
      event_type: 'hospitality',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-16T04:00:00.000Z',
    },
    {
      id: 'demo-tl-d2-3',
      title: 'Lunch',
      day_label: 'DAY 2',
      time_range: '12:00 PM – 1:00 PM',
      start_time: '12:00 PM',
      end_time: '1:00 PM',
      start_timestamp: '2026-10-16T06:30:00.000Z',
      end_timestamp: '2026-10-16T07:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Old Mess, AB1',
      description: 'Lunch service at Old Mess, AB1 prior to final round jury evaluations.',
      card_position: 'right',
      display_order: 8,
      status: 'completed',
      event_type: 'hospitality',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-16T07:30:00.000Z',
    },
    {
      id: 'demo-tl-d2-4',
      title: 'Final Round 3 Judging',
      day_label: 'DAY 2',
      time_range: '1:00 PM – 3:00 PM',
      start_time: '1:00 PM',
      end_time: '3:00 PM',
      start_timestamp: '2026-10-16T07:30:00.000Z',
      end_timestamp: '2026-10-16T09:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Vasanti Pai',
      description: 'Final jury evaluation, live demonstrations, and prototype pitching before the grand jury panel at Vasanti Pai.',
      card_position: 'left',
      display_order: 9,
      status: 'completed',
      event_type: 'eval',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-16T09:30:00.000Z',
    },
    {
      id: 'demo-tl-d2-5',
      title: 'Result & Closing Ceremony',
      day_label: 'DAY 2',
      time_range: '3:00 PM – 5:00 PM',
      start_time: '3:00 PM',
      end_time: '5:00 PM',
      start_timestamp: '2026-10-16T09:30:00.000Z',
      end_timestamp: '2026-10-16T11:30:00.000Z',
      timezone: 'Asia/Kolkata',
      venue: 'Vasanti Pai',
      description: 'Valedictory closing ceremony, announcement of track winners and overall champions, and prize distribution at Vasanti Pai.',
      card_position: 'right',
      display_order: 10,
      status: 'completed',
      event_type: 'awards',
      is_published: true,
      opens_submissions: false,
      closes_submissions: false,
      reminders_enabled: false,
      reminder_offsets_minutes: [],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-16T11:30:00.000Z',
    },
  ];

  return {
    events,
    serverTime: new Date().toISOString(),
    config: {
      is_published: true,
      published_at: '2026-10-14T03:30:00.000Z',
      published_version: 1,
    },
  };
}

/**
 * Resolves a showcase demo project by ID (from data/projects.ts).
 */
export function getDemoSubmission(id: string) {
  const project = projects.find((p) => String(p.id) === String(id));
  if (!project) return null;

  return {
    id: project.id,
    title: project.title,
    teams: { name: project.teamName },
    team_name: project.teamName,
    description: project.fullIdea,
    summary: project.shortIdea,
    technical_challenges: project.technicalDetails,
    lessons_learned: project.reflection,
    demo_video_url: project.demoVideoUrl,
    category: project.category,
    technologies: project.technologies,
    team_members: project.teamMembers,
    status: 'SUBMITTED',
    placement: project.placement,
    created_at: '2026-10-15T08:00:00.000Z',
    updated_at: '2026-10-15T09:00:00.000Z',
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive Synthetic Fixtures for Interactive Role Demos
 * Zero production credentials, zero PII, zero database queries.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DemoTeamMember {
  userId: string;
  name: string;
  email: string;
  role: 'lead' | 'member';
  avatarUrl?: string;
}

export interface DemoParticipantSummary {
  event: typeof DEMO_EVENT_CONFIG;
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    identifier: string;
  };
  team: {
    id: string;
    name: string;
    inviteCode: string;
    track: string;
    leaderName: string;
    members: DemoTeamMember[];
  };
  selectedProblemStatement: {
    id: string;
    title: string;
    track: string;
    difficulty: string;
    scopeNote: string;
    deliverables: string;
    evaluationTests: string;
  };
  submission: {
    id: string;
    title: string;
    summary: string;
    category: string;
    status: string;
    githubUrl: string;
    demoUrl: string;
    docsUrl: string;
    demoVideoUrl: string;
    submittedAt: string;
    isLocked: boolean;
  };
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    type: 'success' | 'info' | 'warning';
    created_at: string;
  }>;
  milestones: Array<{
    time: string;
    title: string;
    status: 'completed' | 'active' | 'upcoming' | 'deadline';
  }>;
}

export const DEMO_PARTICIPANT_SUMMARY: DemoParticipantSummary = {
  event: DEMO_EVENT_CONFIG,
  profile: {
    id: 'usr-demo-lead',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.edu',
    role: 'participant',
    identifier: 'TEAM039',
  },
  team: {
    id: 'demo-team-01',
    name: 'Team NeuralPulse',
    inviteCode: 'PULSE-DEMO-2026',
    track: 'AI/ML & Earth Observation',
    leaderName: 'Aarav Sharma',
    members: [
      { userId: 'u-01', name: 'Aarav Sharma', email: 'aarav.sharma@example.edu', role: 'lead' },
      { userId: 'u-02', name: 'Diya Patel', email: 'diya.patel@example.edu', role: 'member' },
      { userId: 'u-03', name: 'Rohan Gupta', email: 'rohan.gupta@example.edu', role: 'member' },
      { userId: 'u-04', name: 'Ananya Sen', email: 'ananya.sen@example.edu', role: 'member' },
    ],
  },
  selectedProblemStatement: {
    id: 'PS 05',
    title: 'ArcSense: Real-Time Early Warning for Unstable Weld Signatures',
    track: 'AI/ML & Earth Observation',
    difficulty: 'Advanced',
    scopeNote: 'Critical acoustic & electrical sensor streaming for automated arc welding diagnostics in high-throughput manufacturing.',
    deliverables: 'Complete pipeline repository, real-time inferencing API, interactive dashboard, hardware sensor schematics.',
    evaluationTests: 'Simulated high-frequency sensor capture test under fluctuating current load with < 50ms classification latency.',
  },
  submission: {
    id: 'demo-sub-01',
    title: 'ArcSense: Real-Time Early Warning for Unstable Weld Signatures',
    summary: 'Edge-deployed acoustic and electrical signature analyzer predicting welding defects using spectral anomaly detection.',
    category: 'AI/ML & Earth Observation',
    status: 'SUBMITTED',
    githubUrl: 'https://github.com/demo-showcase/arcsense-weld-guardian',
    demoUrl: 'https://arcsense-demo.example.com',
    docsUrl: 'https://docs.arcsense-demo.example.com',
    demoVideoUrl: 'https://youtube.com/watch?v=demo-arcsense',
    submittedAt: '2026-10-15T08:45:00.000Z',
    isLocked: true,
  },
  announcements: [
    {
      id: 'ann-1',
      title: 'Grand Finale Evaluation Concluded',
      content: 'Jury evaluations and final leaderboard rankings have been verified. View your evaluation feedback and overall scores in the results view.',
      type: 'success',
      created_at: '2026-10-16T11:30:00.000Z',
    },
    {
      id: 'ann-2',
      title: 'Final Certificate & Prize Distribution',
      content: 'Award distribution and closing ceremony starts at 3:00 PM at Vasanti Pai Hall.',
      type: 'info',
      created_at: '2026-10-16T12:00:00.000Z',
    },
  ],
  milestones: [
    {
      time: 'Day 1, 09:00 AM',
      title: 'Check-in, Registration Kit & Workstation Allocation',
      status: 'completed',
    },
    {
      time: 'Day 1, 11:00 AM',
      title: 'Opening Ceremony & 35 Challenge Briefs Release',
      status: 'completed',
    },
    {
      time: 'Day 1, 02:00 PM',
      title: '36-Hour Hackathon Sprint Commences',
      status: 'completed',
    },
    {
      time: 'Day 2, 06:00 AM',
      title: 'Judging Round 2: Technical Architecture & Progress Evaluation',
      status: 'completed',
    },
    {
      time: 'Day 2, 01:00 PM',
      title: 'Grand Finale Round 3 Jury Pitching & Live Demonstrations',
      status: 'completed',
    },
    {
      time: 'Day 2, 03:00 PM',
      title: 'Valedictory Closing Ceremony & Awards Announcement',
      status: 'completed',
    },
  ],
};

export function getDemoParticipantSummary(): DemoParticipantSummary {
  return DEMO_PARTICIPANT_SUMMARY;
}

/**
 * Synthetic Judge Evaluation Queue & Rubric Simulator Data
 */
export interface DemoJudgeSubmissionItem {
  id: string;
  submissionId: string;
  teamId: string;
  teamName: string;
  title: string;
  track: string;
  category: string;
  summary: string;
  description: string;
  problemStatementId: string;
  problemStatementTitle: string;
  githubUrl: string;
  demoUrl: string;
  docsUrl: string;
  videoUrl: string;
  reviewStatus: 'completed' | 'pending';
  scores: {
    innovation: number;
    technical: number;
    presentation: number;
    impact: number;
    total: number;
  };
  feedback: string;
  submittedAt: string;
  evaluatedAt?: string;
}

export interface DemoJudgeProfile {
  id: string;
  name: string;
  email: string;
  badgeId: string;
  title: string;
  organization: string;
  assignedTracks: string[];
}

export interface DemoJudgeData {
  judgeProfile: DemoJudgeProfile;
  assignedSubmissions: DemoJudgeSubmissionItem[];
  rubricCriteria: Array<{
    key: 'innovation' | 'technical' | 'presentation' | 'impact';
    title: string;
    weight: string;
    weightNum: number;
    description: string;
    color: string;
  }>;
}

export const DEMO_JUDGE_DATA: DemoJudgeData = {
  judgeProfile: {
    id: 'jdg-882',
    name: 'Dr. Sarah Jenkins',
    email: 'sarah.jenkins@eval.demo',
    badgeId: 'JUDGE-EVAL-882',
    title: 'Principal Research Scientist & Jury Panelist',
    organization: 'Center for Applied Intelligent Systems',
    assignedTracks: ['AI/ML & Earth Observation', 'Cybersecurity', 'Multi-Agent Systems / Logistics'],
  },
  assignedSubmissions: [
    {
      id: 'demo-sub-01',
      submissionId: 'demo-sub-01',
      teamId: 'demo-team-01',
      teamName: 'Team NeuralPulse',
      title: 'ArcSense: Real-Time Early Warning for Unstable Weld Signatures',
      track: 'AI/ML & Earth Observation',
      category: 'AI/ML & Earth Observation',
      summary: 'Edge-deployed acoustic and electrical signature analyzer predicting welding defects using spectral anomaly detection.',
      description: 'ArcSense integrates high-frequency sensor capture with quantized convolutional anomaly detectors to flag micro-fractures and thermal instability in real time, preventing catastrophic weld failures in industrial fabrication.',
      problemStatementId: 'PS 05',
      problemStatementTitle: 'Real-Time Early Warning for Unstable Weld Signatures',
      githubUrl: 'https://github.com/demo-showcase/arcsense-weld-guardian',
      demoUrl: 'https://arcsense-demo.example.com',
      docsUrl: 'https://docs.arcsense-demo.example.com',
      videoUrl: 'https://youtube.com/watch?v=demo-arcsense',
      reviewStatus: 'completed',
      scores: {
        innovation: 9.8,
        technical: 9.6,
        presentation: 9.5,
        impact: 9.7,
        total: 96.5,
      },
      feedback: 'Exceptional edge model deployment with real-time FFT processing. Robust fail-safe handling and outstanding documentation.',
      submittedAt: '2026-10-15T08:45:00.000Z',
      evaluatedAt: '2026-10-16T08:15:00.000Z',
    },
    {
      id: 'demo-sub-04',
      submissionId: 'demo-sub-04',
      teamId: 'demo-team-04',
      teamName: 'Team AgriSense',
      title: 'FarmPulse: Autonomous Multispectral Soil Nutrient Mapping',
      track: 'AI/ML & Earth Observation',
      category: 'AI/ML & Earth Observation',
      summary: 'Low-cost UAV sensor array and offline computer vision pipeline estimating nitrogen-phosphorus-potassium distribution.',
      description: 'FarmPulse operates offline onboard low-cost drones to capture multispectral vegetative indices, processing hyper-local soil fertility maps for smallholder farmers.',
      problemStatementId: 'PS 12',
      problemStatementTitle: 'Multispectral Soil Nutrient Estimation',
      githubUrl: 'https://github.com/demo-showcase/farmpulse-uav',
      demoUrl: 'https://farmpulse.example.com',
      docsUrl: 'https://docs.farmpulse.example.com',
      videoUrl: 'https://youtube.com/watch?v=demo-farmpulse',
      reviewStatus: 'pending',
      scores: {
        innovation: 9.0,
        technical: 9.1,
        presentation: 9.0,
        impact: 9.0,
        total: 90.3,
      },
      feedback: 'Draft: Impressive hardware integration. Needs further clarification on calibration in overcast lighting conditions.',
      submittedAt: '2026-10-15T08:15:00.000Z',
    },
    {
      id: 'demo-sub-03',
      submissionId: 'demo-sub-03',
      teamId: 'demo-team-03',
      teamName: 'Team CyberShield',
      title: 'ZeroTrust Mesh: Hardware Microsegmentation for Legacy SCADA',
      track: 'Cybersecurity',
      category: 'Cybersecurity',
      summary: 'Cryptographic perimeter guard for industrial control systems using eBPF packet filtering and mutual TLS tunnels.',
      description: 'ZeroTrust Mesh wraps legacy programmable logic controllers with inline hardware bump-in-the-wire encryption, preventing unauthorized command injection.',
      problemStatementId: 'PS 18',
      problemStatementTitle: 'SCADA Infrastructure Isolation',
      githubUrl: 'https://github.com/demo-showcase/zerotrust-mesh',
      demoUrl: 'https://zerotrust-demo.example.com',
      docsUrl: 'https://docs.zerotrust.example.com',
      videoUrl: 'https://youtube.com/watch?v=demo-zerotrust',
      reviewStatus: 'completed',
      scores: {
        innovation: 9.2,
        technical: 9.4,
        presentation: 9.1,
        impact: 9.3,
        total: 92.6,
      },
      feedback: 'Deep eBPF implementation with minimal packet overhead. Commendable microsegmentation architecture.',
      submittedAt: '2026-10-15T08:30:00.000Z',
      evaluatedAt: '2026-10-16T08:45:00.000Z',
    },
    {
      id: 'demo-sub-07',
      submissionId: 'demo-sub-07',
      teamId: 'demo-team-07',
      teamName: 'Team AgentCraft',
      title: 'SwarmOps: Decentralized Drone Swarm for Disaster Search & Rescue',
      track: 'Multi-Agent Systems / Logistics',
      category: 'Multi-Agent Systems / Logistics',
      summary: 'Consensus-based multi-agent exploration system operating over ad-hoc mesh radios in GPS-denied environments.',
      description: 'SwarmOps implements distributed frontier exploration where individual drones negotiate search sectors over 915MHz LoRa mesh with zero centralized server dependency.',
      problemStatementId: 'PS 27',
      problemStatementTitle: 'Autonomous Mesh Search & Rescue Swarm',
      githubUrl: 'https://github.com/demo-showcase/swarmops-rescue',
      demoUrl: 'https://swarmops.example.com',
      docsUrl: 'https://docs.swarmops.example.com',
      videoUrl: 'https://youtube.com/watch?v=demo-swarmops',
      reviewStatus: 'pending',
      scores: {
        innovation: 8.6,
        technical: 8.7,
        presentation: 8.5,
        impact: 8.6,
        total: 86.1,
      },
      feedback: '',
      submittedAt: '2026-10-15T08:05:00.000Z',
    },
  ],
  rubricCriteria: [
    {
      key: 'innovation',
      title: 'Innovation & Creativity',
      weight: '30%',
      weightNum: 0.3,
      description: 'Novelty of concept, uniqueness of technical approach, and creative problem-solving.',
      color: 'text-primary',
    },
    {
      key: 'technical',
      title: 'Technical Execution',
      weight: '30%',
      weightNum: 0.3,
      description: 'Code architecture, algorithmic complexity, runtime reliability, scalability, and engineering rigor.',
      color: 'text-secondary',
    },
    {
      key: 'presentation',
      title: 'UI/UX & Presentation',
      weight: '20%',
      weightNum: 0.2,
      description: 'Design polish, accessibility, documentation quality, and live demonstration execution.',
      color: 'text-jaipur-pink',
    },
    {
      key: 'impact',
      title: 'Impact & Viability',
      weight: '20%',
      weightNum: 0.2,
      description: 'Real-world deployment feasibility, market/community viability, and problem significance.',
      color: 'text-jaipur-terracotta',
    },
  ],
};

export function getDemoJudgeData(): DemoJudgeData {
  return DEMO_JUDGE_DATA;
}

export function getDemoJudgeSubmission(id: string): DemoJudgeSubmissionItem | null {
  return DEMO_JUDGE_DATA.assignedSubmissions.find((s) => s.id === id || s.submissionId === id) || null;
}

/**
 * Synthetic Admin Operations Console Data
 */
export interface DemoAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'participant' | 'judge' | 'admin';
  teamName?: string;
  status: 'active' | 'verified';
  createdAt: string;
}

export interface DemoAdminSubmissionRecord {
  id: string;
  teamName: string;
  title: string;
  track: string;
  status: 'submitted' | 'reviewed';
  score?: number;
  rank?: number;
  submittedAt: string;
  membersCount: number;
  demoUrl?: string;
  githubUrl?: string;
}

export interface DemoJudgeAllocation {
  judgeId: string;
  judgeName: string;
  badgeId: string;
  assignedCount: number;
  completedCount: number;
  assignedTracks: string[];
}

export interface DemoAuditLogRecord {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  status: 'success' | 'blocked' | 'info';
  details: string;
}

export interface DemoAdminData {
  stats: {
    totalTeams: number;
    totalSubmissions: number;
    submittedCount: number;
    reviewedCount: number;
    totalUsers: number;
    avgScore: number;
    tracksCount: number;
  };
  users: DemoAdminUser[];
  submissions: DemoAdminSubmissionRecord[];
  judgeAllocations: DemoJudgeAllocation[];
  auditLogs: DemoAuditLogRecord[];
}

export const DEMO_ADMIN_DATA: DemoAdminData = {
  stats: {
    totalTeams: 86,
    totalSubmissions: 78,
    submittedCount: 78,
    reviewedCount: 74,
    totalUsers: 342,
    avgScore: 87.4,
    tracksCount: 9,
  },
  users: [
    { id: 'usr-01', name: 'Aarav Sharma', email: 'aarav.sharma@demo.edu', role: 'participant', teamName: 'Team NeuralPulse', status: 'verified', createdAt: '2026-10-14T04:15:00.000Z' },
    { id: 'usr-02', name: 'Diya Patel', email: 'diya.patel@demo.edu', role: 'participant', teamName: 'Team NeuralPulse', status: 'verified', createdAt: '2026-10-14T04:20:00.000Z' },
    { id: 'usr-03', name: 'Dr. Sarah Jenkins', email: 'sarah.jenkins@eval.demo', role: 'judge', status: 'active', createdAt: '2026-10-14T02:00:00.000Z' },
    { id: 'usr-04', name: 'Vikram Mehta', email: 'vikram.mehta@demo.edu', role: 'participant', teamName: 'Team MedVanguard', status: 'verified', createdAt: '2026-10-14T04:45:00.000Z' },
    { id: 'usr-05', name: 'Prof. Rajesh Kulkarni', email: 'rajesh.kulkarni@eval.demo', role: 'judge', status: 'active', createdAt: '2026-10-14T02:10:00.000Z' },
    { id: 'usr-06', name: 'Organizing Chair', email: 'ops.chair@portal.demo', role: 'admin', status: 'active', createdAt: '2026-10-13T10:00:00.000Z' },
    { id: 'usr-07', name: 'Ananya Sen', email: 'ananya.sen@demo.edu', role: 'participant', teamName: 'Team NeuralPulse', status: 'verified', createdAt: '2026-10-14T04:22:00.000Z' },
    { id: 'usr-08', name: 'Dr. Elena Rostova', email: 'elena.rostova@eval.demo', role: 'judge', status: 'active', createdAt: '2026-10-14T02:15:00.000Z' },
    { id: 'usr-09', name: 'Priya Iyer', email: 'priya.iyer@demo.edu', role: 'participant', teamName: 'Team CyberShield', status: 'verified', createdAt: '2026-10-14T05:00:00.000Z' },
    { id: 'usr-10', name: 'System Security Lead', email: 'sec.audit@portal.demo', role: 'admin', status: 'active', createdAt: '2026-10-13T10:15:00.000Z' },
    { id: 'usr-11', name: 'Kabir Verma', email: 'kabir.verma@demo.edu', role: 'participant', teamName: 'Team AgriSense', status: 'verified', createdAt: '2026-10-14T05:12:00.000Z' },
    { id: 'usr-12', name: 'Dr. Michael Chen', email: 'michael.chen@eval.demo', role: 'judge', status: 'active', createdAt: '2026-10-14T02:30:00.000Z' },
    { id: 'usr-13', name: 'Neha Deshmukh', email: 'neha.d@demo.edu', role: 'participant', teamName: 'Team EduFlow', status: 'verified', createdAt: '2026-10-14T05:30:00.000Z' },
    { id: 'usr-14', name: 'Arjun Nair', email: 'arjun.nair@demo.edu', role: 'participant', teamName: 'Team GridSync', status: 'verified', createdAt: '2026-10-14T05:40:00.000Z' },
    { id: 'usr-15', name: 'Technical Director', email: 'tech.director@portal.demo', role: 'admin', status: 'active', createdAt: '2026-10-13T10:20:00.000Z' },
  ],
  submissions: [
    { id: 'demo-sub-01', teamName: 'Team NeuralPulse', title: 'ArcSense: Real-Time Early Warning for Unstable Weld Signatures', track: 'AI/ML & Earth Observation', status: 'reviewed', score: 96.5, rank: 1, submittedAt: '2026-10-15T08:45:00.000Z', membersCount: 4, demoUrl: 'https://arcsense-demo.example.com', githubUrl: 'https://github.com/demo-showcase/arcsense' },
    { id: 'demo-sub-02', teamName: 'Team MedVanguard', title: 'SafeDose: Automated Pediatric Dosing Verification Protocol', track: 'HealthTech', status: 'reviewed', score: 94.8, rank: 2, submittedAt: '2026-10-15T08:50:00.000Z', membersCount: 4, demoUrl: 'https://safedose.example.com', githubUrl: 'https://github.com/demo-showcase/safedose' },
    { id: 'demo-sub-03', teamName: 'Team CyberShield', title: 'ZeroTrust Mesh: Hardware Microsegmentation for Legacy SCADA', track: 'Cybersecurity', status: 'reviewed', score: 92.4, rank: 3, submittedAt: '2026-10-15T08:30:00.000Z', membersCount: 3, demoUrl: 'https://zerotrust.example.com', githubUrl: 'https://github.com/demo-showcase/zerotrust' },
    { id: 'demo-sub-04', teamName: 'Team AgriSense', title: 'FarmPulse: Autonomous Multispectral Soil Nutrient Mapping', track: 'AI/ML & Earth Observation', status: 'reviewed', score: 90.1, rank: 4, submittedAt: '2026-10-15T08:15:00.000Z', membersCount: 4, demoUrl: 'https://farmpulse.example.com', githubUrl: 'https://github.com/demo-showcase/farmpulse' },
    { id: 'demo-sub-05', teamName: 'Team EduFlow', title: 'OmniLearn: Multimodal Adaptive Curriculum Engine', track: 'FinTech / EdTech / LegalTech', status: 'reviewed', score: 88.7, rank: 5, submittedAt: '2026-10-15T08:20:00.000Z', membersCount: 4, demoUrl: 'https://omnilearn.example.com', githubUrl: 'https://github.com/demo-showcase/omnilearn' },
    { id: 'demo-sub-06', teamName: 'Team GridSync', title: 'ResilientGrid: Distributed Frequency Stabilizer for Solar Rooftops', track: 'Smart City & Infrastructure', status: 'reviewed', score: 87.2, rank: 6, submittedAt: '2026-10-15T08:10:00.000Z', membersCount: 4, demoUrl: 'https://gridsync.example.com', githubUrl: 'https://github.com/demo-showcase/gridsync' },
    { id: 'demo-sub-07', teamName: 'Team AgentCraft', title: 'SwarmOps: Decentralized Drone Swarm for Disaster Search & Rescue', track: 'Multi-Agent Systems / Logistics', status: 'reviewed', score: 86.0, rank: 7, submittedAt: '2026-10-15T08:05:00.000Z', membersCount: 4, demoUrl: 'https://swarmops.example.com', githubUrl: 'https://github.com/demo-showcase/swarmops' },
    { id: 'demo-sub-08', teamName: 'Team GreenTrace', title: 'CarbonLedger: Zero-Knowledge Supply Chain Scope-3 Emission Audits', track: 'Open Innovation in Hardware', status: 'reviewed', score: 84.5, rank: 8, submittedAt: '2026-10-15T07:55:00.000Z', membersCount: 3, demoUrl: 'https://greentrace.example.com', githubUrl: 'https://github.com/demo-showcase/greentrace' },
    { id: 'demo-sub-09', teamName: 'Team ImmersiSim', title: 'SurgicalXR: Sub-Millimeter Haptic-Feedback Telepresence Simulator', track: 'Gaming & Immersive Tech', status: 'reviewed', score: 83.1, rank: 9, submittedAt: '2026-10-15T07:50:00.000Z', membersCount: 4, demoUrl: 'https://surgicalxr.example.com', githubUrl: 'https://github.com/demo-showcase/surgicalxr' },
    { id: 'demo-sub-10', teamName: 'Team DeepLex', title: 'NyayaAI: Multilingual Vernacular Legal Precedent Synthesizer', track: 'Generative AI & LLM Systems', status: 'reviewed', score: 81.9, rank: 10, submittedAt: '2026-10-15T07:45:00.000Z', membersCount: 3, demoUrl: 'https://deeplex.example.com', githubUrl: 'https://github.com/demo-showcase/deeplex' },
  ],
  judgeAllocations: [
    { judgeId: 'jdg-882', judgeName: 'Dr. Sarah Jenkins', badgeId: 'JUDGE-EVAL-882', assignedCount: 16, completedCount: 16, assignedTracks: ['AI/ML & Earth Observation', 'Cybersecurity', 'Multi-Agent Systems / Logistics'] },
    { judgeId: 'jdg-883', judgeName: 'Prof. Rajesh Kulkarni', badgeId: 'JUDGE-EVAL-883', assignedCount: 18, completedCount: 18, assignedTracks: ['HealthTech', 'Smart City & Infrastructure'] },
    { judgeId: 'jdg-884', judgeName: 'Dr. Elena Rostova', badgeId: 'JUDGE-EVAL-884', assignedCount: 16, completedCount: 15, assignedTracks: ['FinTech / EdTech / LegalTech', 'Open Innovation in Hardware'] },
    { judgeId: 'jdg-885', judgeName: 'Dr. Michael Chen', badgeId: 'JUDGE-EVAL-885', assignedCount: 14, completedCount: 13, assignedTracks: ['Generative AI & LLM Systems', 'Gaming & Immersive Tech'] },
    { judgeId: 'jdg-886', judgeName: 'Anandita Roy', badgeId: 'JUDGE-EVAL-886', assignedCount: 14, completedCount: 12, assignedTracks: ['AI/ML & Earth Observation', 'Multi-Agent Systems / Logistics'] },
  ],
  auditLogs: [
    { id: 'log-12', timestamp: '2026-10-16T11:30:15.000Z', actor: 'Organizing Chair', role: 'admin', action: 'RESULTS_PUBLISHED', target: 'Leaderboard Public Release', status: 'success', details: 'Final verified leaderboard and rubric scores approved and released publicly.' },
    { id: 'log-11', timestamp: '2026-10-16T11:00:00.000Z', actor: 'System Security Lead', role: 'admin', action: 'GLOBAL_FREEZE_ENABLED', target: 'Event Configuration', status: 'success', details: 'All participant and judge mutation pathways globally locked for ceremony.' },
    { id: 'log-10', timestamp: '2026-10-16T10:45:22.000Z', actor: 'Dr. Sarah Jenkins', role: 'judge', action: 'SCORE_SUBMITTED', target: 'demo-sub-01 (ArcSense)', status: 'success', details: 'Completed evaluation with weighted score 96.5 across 4 rubric criteria.' },
    { id: 'log-09', timestamp: '2026-10-16T09:30:00.000Z', actor: 'System Scheduler', role: 'system', action: 'SUBMISSION_WINDOW_CLOSED', target: 'Submission Form', status: 'success', details: 'Hard deadline reached. Automatic lock applied to 78 submitted project dossiers.' },
    { id: 'log-08', timestamp: '2026-10-16T06:00:00.000Z', actor: 'Organizing Chair', role: 'admin', action: 'ROUND_TRANSITION', target: 'Round 2 Judging', status: 'success', details: 'Transitioned active event phase to Round 2 Progress Evaluations.' },
    { id: 'log-07', timestamp: '2026-10-15T14:00:00.000Z', actor: 'System Monitor', role: 'system', action: 'SECURITY_RATE_LIMIT_CHECK', target: 'API Gateway', status: 'info', details: 'Zero rate limit anomalies detected across 342 active concurrent user sessions.' },
    { id: 'log-06', timestamp: '2026-10-15T08:45:10.000Z', actor: 'Aarav Sharma', role: 'participant', action: 'SUBMISSION_CREATED', target: 'ArcSense: Real-Time Early Warning', status: 'success', details: 'Artifacts committed with valid GitHub, live demo, and video links.' },
    { id: 'log-05', timestamp: '2026-10-15T04:00:00.000Z', actor: 'Technical Director', role: 'admin', action: 'JUDGE_ASSIGNMENT_DISPATCH', target: '78 Submissions', status: 'success', details: 'Automated 3-judge panel allocation executed across 9 technical tracks.' },
    { id: 'log-04', timestamp: '2026-10-15T02:00:00.000Z', actor: 'Organizing Chair', role: 'admin', action: 'HACKATHON_SPRINT_START', target: 'Event Timer', status: 'success', details: '36-hour sprint countdown officially initiated at Manipal University Jaipur.' },
    { id: 'log-03', timestamp: '2026-10-14T03:30:00.000Z', actor: 'Organizing Chair', role: 'admin', action: 'CHALLENGES_PUBLISHED', target: '35 Problem Statements', status: 'success', details: 'Official 35 challenge briefs made visible to all registered participants.' },
    { id: 'log-02', timestamp: '2026-10-13T14:20:00.000Z', actor: 'System Security Lead', role: 'admin', action: 'ROLE_VERIFIED', target: 'Jury Panelists (14 users)', status: 'success', details: 'Verified hardware 2FA keys and assigned judge badges.' },
    { id: 'log-01', timestamp: '2026-10-13T10:00:00.000Z', actor: 'System', role: 'system', action: 'ENV_INITIALIZATION', target: 'Code-e-Manipal Portal', status: 'info', details: 'Portal initialization completed with strict data isolation policies.' },
  ],
};

export function getDemoAdminData(): DemoAdminData {
  return DEMO_ADMIN_DATA;
}
