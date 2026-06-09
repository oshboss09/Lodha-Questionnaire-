export interface Question {
  id?: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  order: number;
}

export interface Submission {
  id?: string;
  fullName: string;
  department: string;
  email: string;
  score: number;
  totalQuestions: number;
  responses: Record<string, number>; // questionId -> selectedIndex
  timestamp: any;
  status?: string;
  auto_submitted?: boolean;
}

export interface GlobalConfig {
  timerPerQuestion: number;
  themePrimary: string;
  googleSheetsWebhookUrl: string;
  // Feedback thresholds (Percentage)
  passThreshold: number;
  excellentThreshold: number;
  // Feedback content
  failTitle: string;
  failDesc: string;
  passTitle: string;
  passDesc: string;
  excellentTitle: string;
  excellentDesc: string;
  questionsPerAssessment?: number;
}

export interface UserDetails {
  fullName: string;
  department: string;
  email: string;
}

export interface EligibleParticipant {
  id?: string;
  email: string;
  createdAt: any;
}
