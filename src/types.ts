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
}

export interface UserDetails {
  fullName: string;
  department: string;
  email: string;
}
