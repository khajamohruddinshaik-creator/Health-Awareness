export interface UserAccount {
  id: number;
  docId?: string;
  uid?: string;
  name: string;
  email: string;
  phone: string;
  createdAt?: string;
}

export interface AuthSession {
  id?: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

export type PortalView = 'auth' | 'portal' | 'admin';
export type AuthTab = 'login' | 'register' | 'admin';
export type PortalSection =
  | 'home'
  | 'awareness'
  | 'food'
  | 'checklist'
  | 'quiz'
  | 'chat'
  | 'contact';

export type ChatRoleId = 'hygiene-coach' | 'nutrition-guide' | 'quick-helper';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  model?: string;
}

export interface AwarenessTopic {
  id: string;
  number: string;
  title: string;
  category: string;
  description: string;
  dailyAction: string;
}

export interface HandwashingStep {
  step: number;
  title: string;
  instruction: string;
}

export interface NutritionItem {
  id: string;
  number: string;
  title: string;
  focus: string;
  description: string;
  examples: string;
}

export interface ChecklistHabit {
  id: string;
  label: string;
  category: string;
}

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  number: number;
  prompt: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
}

export interface ContactInquiry {
  id: number;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}
