/**
 * Common Utilities
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return formatDate(d);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatNominalInput(value: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  
  const strValue = String(value);
  
  // Check if it has a decimal point in JS format (dot)
  const parts = strValue.split('.');
  const integerPart = parts[0].replace(/\D/g, ''); // only digits
  
  if (integerPart === '' && !parts[1]) return '';
  
  const formattedInteger = integerPart !== '' ? Number(integerPart).toLocaleString('id-ID') : '0';
  
  if (parts.length > 1) {
    const decimalPart = parts[1].replace(/\D/g, '');
    if (strValue.endsWith('.')) {
      return `${formattedInteger},`;
    }
    return `${formattedInteger},${decimalPart}`;
  }
  
  return formattedInteger;
}

export function cleanNominalInput(value: string): string {
  if (!value) return '';
  
  // Check if comma is used as Indonesian decimal separator
  const commas = value.match(/,/g);
  if (commas && commas.length === 1) {
    const parts = value.split(',');
    const before = parts[0].replace(/\D/g, '');
    const after = parts[1].replace(/\D/g, '');
    if (after.length === 0) {
      return `${before}.`;
    }
    return `${before}.${after}`;
  }
  
  // If multiple commas or no commas, treat any dots/commas as thousand separators and keep only digits
  return value.replace(/\D/g, '');
}

