import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format ISO date (YYYY-MM-DD) to EU format DD.MM.YYYY for UI display */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const parts = iso.split('T')[0].split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}
