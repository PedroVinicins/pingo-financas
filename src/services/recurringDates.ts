import type { RecurringRule } from '../types/finance'

const DAY_MS = 86_400_000

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function dateForMonth(year: number, month: number, dayOfMonth: number) {
  return new Date(year, month, Math.min(dayOfMonth, daysInMonth(year, month)), 0, 0, 0, 0)
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

export function firstRecurringDueDate(dayOfMonth: number, createdAt = new Date()) {
  const createdDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())
  let due = dateForMonth(createdDay.getFullYear(), createdDay.getMonth(), dayOfMonth)
  if (due.getTime() < createdDay.getTime()) {
    due = dateForMonth(createdDay.getFullYear(), createdDay.getMonth() + 1, dayOfMonth)
  }
  return localDateKey(due)
}

export function followingRecurringDueDate(dayOfMonth: number, currentDueDate: string) {
  const current = parseLocalDate(currentDueDate)
  return localDateKey(dateForMonth(current.getFullYear(), current.getMonth() + 1, dayOfMonth))
}

export function isRecurringRuleDue(rule: Pick<RecurringRule, 'active' | 'nextDueDate'>, now = new Date()) {
  return rule.active && localDateKey(now) >= rule.nextDueDate
}

export function daysAfterRecurringDueDate(nextDueDate: string, now = new Date()) {
  const due = parseLocalDate(nextDueDate)
  const todayKey = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const dueKey = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())
  return Math.floor((todayKey - dueKey) / DAY_MS)
}
