/**
 * Application Type Definitions
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  themePreference: 'light' | 'dark';
  paydayDate?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  paydayDate?: number;
  otpCode?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
}

export interface PocketSummary {
  id: string;
  name: string;
  type: 'MAIN' | 'EMERGENCY' | 'SAVINGS' | 'WISHLIST';
  balance: number;
  targetAmount?: number;
  status: 'active' | 'completed';
  progressPercentage?: number;
}

export interface DailyMetrics {
  date: string;
  dailyAllowance: number;
  totalSpent: number;
  percentageUsed: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  remaining: number;
  pocketSummary: PocketSummary[];
}

export interface TransactionRecord {
  id: string;
  type: 'INCOME_ROUTINE' | 'INCOME_BONUS' | 'EXPENSE';
  amount: number;
  category?: string;
  categoryType?: 'NEED' | 'WANT';
  pocket: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface DashboardData {
  user: AuthUser;
  dailyMetrics: DailyMetrics;
  recentTransactions: TransactionRecord[];
  aiRoasterMessage?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  type: 'NEED' | 'WANT';
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
