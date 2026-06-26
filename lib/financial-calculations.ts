/**
 * Financial Calculation Utilities
 * Implements formulas from FR-DASH-01, FR-DASH-02, and related business rules
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Calculate daily allowance (Jatah Harian)
 * Formula: (Main Wallet Balance - Pending Bills) / Days Left in Month
 * Implements: FR-DASH-01
 */
export function calculateDailyAllowance(
  mainWalletBalance: number | Decimal,
  pendingBills: number | Decimal,
  daysLeftInMonth: number
): number {
  if (daysLeftInMonth <= 0) return 0;

  const balance = typeof mainWalletBalance === 'number' 
    ? mainWalletBalance 
    : mainWalletBalance.toNumber();
  
  const bills = typeof pendingBills === 'number' 
    ? pendingBills 
    : pendingBills.toNumber();

  return Math.max(0, (balance - bills) / daysLeftInMonth);
}

/**
 * Determine status indicator based on spending percentage
 * Implements: FR-DASH-02
 */
export type SpendingStatus = 'GREEN' | 'YELLOW' | 'RED';

export function determineSpendingStatus(
  percentageUsed: number
): SpendingStatus {
  if (percentageUsed < 80) return 'GREEN';
  if (percentageUsed <= 100) return 'YELLOW';
  return 'RED';
}

/**
 * Get remaining days in current month (inclusive of today)
 */
export function getDaysLeftInMonth(date: Date = new Date()): number {
  const now = new Date(date);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = lastDayOfMonth.getDate() - now.getDate() + 1; // +1 to include today
  return Math.max(1, daysLeft);
}

/**
 * Calculate bonus income distribution
 * Implements: FR-IN-03 (automatic distribution for bonus income)
 */
interface BonusDistribution {
  emergency: number;
  savings: number;
  wishlist: number;
  main: number;
}

export function calculateBonusDistribution(
  amount: number,
  isEmergencyFull: boolean = true
): BonusDistribution {
  // Default: 50% Emergency/Savings, 30% Wishlist, 20% Main
  // But prioritize Emergency if not full (BR-03)
  
  if (isEmergencyFull) {
    return {
      emergency: amount * 0.5,
      savings: 0,
      wishlist: amount * 0.3,
      main: amount * 0.2,
    };
  }

  // If Emergency not full, prioritize it first
  return {
    emergency: amount * 0.5,
    savings: amount * 0.3,
    wishlist: amount * 0.2,
    main: 0,
  };
}

/**
 * Calculate percentage of daily allowance used
 */
export function calculateSpendingPercentage(
  spent: number | Decimal,
  dailyAllowance: number
): number {
  if (dailyAllowance <= 0) return 0;

  const spentAmount = typeof spent === 'number' 
    ? spent 
    : spent.toNumber();

  return Math.min((spentAmount / dailyAllowance) * 100, 999999.99);
}
