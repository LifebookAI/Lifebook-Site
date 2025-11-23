export type StudyTrackId = 'aws-foundations' | 'devops-essentials';

export type StudyTrackStep = {
  id: string;
  title: string;
  summary: string;
  expectedArtifact: string;
  /**
   * Optional deep-link into the app where this step is usually executed.
   * Example: /workflows, /captures, /library, or a specific workflow template.
   */
  href?: string;
};

export type StudyTrackLevel = 'beginner' | 'intermediate';

export type StudyTrack = {
  id: StudyTrackId;
  title: string;
  tagline: string;
  description: string;
  level: StudyTrackLevel;
  estimatedDurationMinutes: number;
  steps: StudyTrackStep[];
};
