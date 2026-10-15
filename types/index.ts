export type UserRole = 'participant' | 'judge' | 'admin';
export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'reviewed';
export type TeamMemberRole = 'leader' | 'member';

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  identifier?: string | null;
  login_id?: string | null;
  is_disabled?: boolean;
  force_logout_before?: string | null;
  created_at: string;
  updated_at: string;
  team_id?: string | null;
  team_name?: string | null;
  registration_team_id?: string | null;
  team_member_role?: TeamMemberRole | null;
}

export interface Team {
  id: string;
  name: string;
  leader_name: string | null;
  hackathon: string;
  invite_code: string;
  created_by: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  team_members?: TeamMember[];
}

export interface TeamMember {
  id?: string;
  team_id: string;
  user_id?: string | null;
  role: TeamMemberRole;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  college?: string | null;
  study_year?: string | null;
  is_verified?: boolean;
  joined_at: string;
  profiles?: Pick<Profile, 'name' | 'avatar_url' | 'email'>;
}

export interface Submission {
  id: string;
  team_id: string;
  title: string;
  summary: string;
  description: string | null;
  category: string;
  technologies: string[];
  github_url: string | null;
  demo_url: string | null;
  docs_url: string | null;
  demo_video_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  teams?: Pick<Team, 'name' | 'hackathon'>;
}

export interface JudgeReview {
  id: string;
  submission_id: string;
  judge_id: string;
  score_innovation: number | null;
  score_technical: number | null;
  score_presentation: number | null;
  score_impact: number | null;
  feedback: string | null;
  is_complete: boolean;
  version?: number;
  total_score?: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewHistoryEntry {
  id: string;
  review_id: string;
  submission_id: string;
  judge_id: string;
  round: string;
  version: number;
  previous_scores: {
    score_innovation: number | null;
    score_technical: number | null;
    score_presentation: number | null;
    score_impact: number | null;
    total?: number | null;
  };
  previous_feedback: string | null;
  changed_by: string;
  changed_at: string;
  reason: string;
}

export interface JudgeAssignment {
  judge_id: string;
  submission_id: string;
  assigned_at: string;
  submissions?: Submission;
}

export interface AnalyticsData {
  total_submissions: number;
  submitted_count: number;
  reviewed_count: number;
  total_teams: number;
  category_breakdown: Record<string, number>;
  avg_scores: {
    innovation: number;
    technical: number;
    presentation: number;
    impact: number;
  };
}

export type UpdateProfileInput = Partial<Pick<Profile, 'name' | 'avatar_url'>>;

export interface RankedSubmission {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  teams: { id: string; name: string; hackathon: string } | null;
  computed: {
    avg_innovation: number;
    avg_technical: number;
    avg_presentation: number;
    avg_impact: number;
    total_score: number;
    review_count: number;
    rank: number;
  };
}

export interface PaginationParams { limit: number; offset: number; }
export interface ApiSuccess<T> { data: T; meta?: Record<string, unknown>; }
export interface ApiError { error: string; code?: string; }

// ── Hackathon Registration ────────────────────────────────────
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface HackathonRegistration {
  id: string;
  name: string;
  team_name: string;
  phone: string;
  email: string;
  round: number;
  status: RegistrationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}