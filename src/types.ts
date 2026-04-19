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
  totalQuestions: number;
  themePrimary: string;
  backgroundUrl: string;
  googleSheetsWebhookUrl: string;
}

export interface UserDetails {
  fullName: string;
  department: string;
  email: string;
}
