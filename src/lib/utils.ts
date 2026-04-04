// src/lib/utils.ts
import { format } from 'date-fns'
import clsx from 'clsx'
export { clsx }

export function fmt(value: number | null | undefined, decimals = 0): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value) + ' DA'
}

export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy')
}

export function fmtDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}
