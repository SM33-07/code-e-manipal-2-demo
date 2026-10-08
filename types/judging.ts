// Aligned with DB judge_reviews schema: 4 criteria × 1-10 scale

export interface Criteria {
  innovation: number;
  technical: number;
  presentation: number;
  impact: number;
}

export interface Score {
  submissionId: string;
  judgeId: string;
  criteria: Criteria;
  feedback: string;
  isComplete: boolean;
  version?: number;
}

export interface Submission {
  id: string;
  title: string;
  description: string;
  writeup: string;
  reflection: string;
  demoUrl: string;
  teamSize: number;
}

export const WEIGHTS = {
  innovation: 0.30,
  technical: 0.30,
  presentation: 0.20,
  impact: 0.20,
};

export const CRITERIA_NAMES = {
  innovation: 'Innovation',
  technical: 'Technical Implementation',
  presentation: 'Presentation',
  impact: 'Impact',
};

export const CRITERIA_DESCRIPTIONS = {
  innovation: 'Novelty and originality of the solution.',
  technical: 'Quality of code, architecture, and complexity.',
  presentation: 'Clarity and quality of the demo and write-up.',
  impact: 'Potential real-world impact and scalability.',
};
