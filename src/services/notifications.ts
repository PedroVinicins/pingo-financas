import { isTauriRuntime } from './financeRepository'
import type { CurrencyCode, RecurringRule } from '../types/finance'
import type { AccountAnalysis } from './accountAnalysis'
import { localDateKey } from './recurringDates'
import { formatCurrencyValue, privateCurrencyCents } from './currency'

export type ReminderFrequencyDays = 1 | 3 | 7

export interface ReminderSettings {
  enabled: boolean
  frequencyDays: ReminderFrequencyDays
  lastWebNotificationAt: string | null
}

const SETTINGS_KEY = 'pingo:notification-settings'
const REMINDER_ID = 41041
const TEST_ID = 41042
const CHANNEL_ID = 'money-reminders'
const ANALYSIS_CHANNEL_ID = 'account-analysis'
const ANALYSIS_NOTIFICATION_ID = 41050
const ANALYSIS_NOTIFICATION_LOG_KEY = 'pingo:analysis-notification-log'
const RECURRING_NOTIFICATION_LOG_KEY = 'pingo:recurring-notification-log'
const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  frequencyDays: 1,
  lastWebNotificationAt: null,
}

const reminderMessages = [
  'Você mexeu no seu dinheiro? Vem atualizar aqui!',
  'Já pingou dinheiro na sua conta? Vem atualizar aqui!',
  'Fez uma compra hoje? Registre agora para não esquecer.',
]

interface AnalysisNotificationLog {
  key: string
  sentAt: string
}

export function loadReminderSettings(): ReminderSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<ReminderSettings>
    const frequencyDays = stored.frequencyDays === 3 || stored.frequencyDays === 7 ? stored.frequencyDays : 1
    return {
      enabled: stored.enabled === true,
      frequencyDays,
      lastWebNotificationAt: stored.lastWebNotificationAt ?? null,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveReminderSettings(settings: ReminderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function messageForToday() {
  return reminderMessages[new Date().getDate() % reminderMessages.length]
}

async function ensurePermission(): Promise<boolean> {
  if (isTauriRuntime()) {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
    if (await isPermissionGranted()) return true
    return (await requestPermission()) === 'granted'
  }

  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

async function hasPermissionWithoutPrompt(): Promise<boolean> {
  if (isTauriRuntime()) {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    return isPermissionGranted()
  }
  return 'Notification' in window && Notification.permission === 'granted'
}

async function createAnalysisChannel() {
  if (!isTauriRuntime()) return
  const { createChannel, Importance, Visibility } = await import('@tauri-apps/plugin-notification')
  try {
    await createChannel({
      id: ANALYSIS_CHANNEL_ID,
      name: 'Análises da conta',
      description: 'Problemas e mudanças importantes encontrados nos registros financeiros do Pingo',
      importance: Importance.High,
      visibility: Visibility.Private,
      vibration: true,
    })
  } catch {
    // O canal já pode existir no Android.
  }
}

export function analysisNotificationCopy(analysis: AccountAnalysis, currency: CurrencyCode, hidden = false) {
  const problem = analysis.alerts.find((alert) => alert.severity === 'critical' || alert.severity === 'warning')
  if (problem) return {
    title: problem.severity === 'critical' ? 'Pingo · Atenção na sua conta' : 'Pingo · Análise atualizada',
    body: `${problem.title}: ${problem.message}`,
  }
  return {
    title: 'Pingo · Resumo da análise',
    body: `Entradas ${privateCurrencyCents(analysis.incomeCents, currency, hidden)} · saídas ${privateCurrencyCents(analysis.expenseCents, currency, hidden)}. ${analysis.alerts[0]?.title ?? 'Confira os detalhes no app.'}`,
  }
}

function loadAnalysisNotificationLog(): AnalysisNotificationLog | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANALYSIS_NOTIFICATION_LOG_KEY) ?? 'null') as Partial<AnalysisNotificationLog> | null
    return parsed?.key && parsed.sentAt ? { key: parsed.key, sentAt: parsed.sentAt } : null
  } catch { return null }
}

async function sendAccountAnalysisNotification(
  analysis: AccountAnalysis,
  currency: CurrencyCode,
  options: { requestPermission: boolean; force: boolean; hidden: boolean },
) {
  if (!options.force && analysis.transactionCount === 0) return false
  const permitted = options.requestPermission ? await ensurePermission() : await hasPermissionWithoutPrompt()
  if (!permitted) {
    if (options.requestPermission) throw new Error('Permissão de notificações não concedida')
    return false
  }

  const now = Date.now()
  const problem = analysis.alerts.find((alert) => alert.severity === 'critical' || alert.severity === 'warning')
  const key = problem ? analysis.notificationKey : `${analysis.periodKey}:summary`
  const log = loadAnalysisNotificationLog()
  if (!options.force && log) {
    const elapsed = now - new Date(log.sentAt).getTime()
    const minimumInterval = problem ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    if (log.key === key && elapsed < minimumInterval) return false
    if (log.key !== key && elapsed < 4 * 60 * 60 * 1000) return false
  }

  const copy = analysisNotificationCopy(analysis, currency, options.hidden)
  if (isTauriRuntime()) {
    await createAnalysisChannel()
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    sendNotification({
      id: ANALYSIS_NOTIFICATION_ID,
      channelId: ANALYSIS_CHANNEL_ID,
      ...copy,
      largeBody: copy.body,
      autoCancel: true,
    })
  } else {
    const notification = new Notification(copy.title, { body: copy.body, tag: 'pingo-account-analysis' })
    notification.onclick = () => { window.focus(); notification.close() }
  }
  localStorage.setItem(ANALYSIS_NOTIFICATION_LOG_KEY, JSON.stringify({ key, sentAt: new Date(now).toISOString() }))
  return true
}

export async function enableAnalysisNotifications(analysis: AccountAnalysis, currency: CurrencyCode, hidden = false) {
  return sendAccountAnalysisNotification(analysis, currency, { requestPermission: true, force: true, hidden })
}

export async function disableAnalysisNotifications() {
  if (isTauriRuntime()) {
    const { cancel } = await import('@tauri-apps/plugin-notification')
    await cancel([ANALYSIS_NOTIFICATION_ID]).catch(() => undefined)
  }
}

export async function maybeNotifyAccountAnalysis(analysis: AccountAnalysis, currency: CurrencyCode, hidden = false) {
  return sendAccountAnalysisNotification(analysis, currency, { requestPermission: false, force: false, hidden })
}

export async function sendAnalysisNotificationTest(analysis: AccountAnalysis, currency: CurrencyCode, hidden = false) {
  return sendAccountAnalysisNotification(analysis, currency, { requestPermission: true, force: true, hidden })
}

function recurringNotificationId(id: string) {
  let hash = 0
  for (const character of id) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return 50_000 + Math.abs(hash % 900_000)
}

export function recurringNotificationCopy(rule: RecurringRule, currency: CurrencyCode) {
  const amount = formatCurrencyValue(rule.amount, currency)
  return rule.kind === 'income'
    ? { title: 'Pingo · Opa, já pingou?', body: `${rule.description}: ${amount}, previsto para hoje. Confirme quando cair.` }
    : { title: 'Pingo · Conta para hoje', body: `${rule.description}: ${amount}, vence hoje. Toque para confirmar quando pagar.` }
}

async function scheduleNativeReminder(frequencyDays: ReminderFrequencyDays) {
  const {
    cancel,
    createChannel,
    Importance,
    Schedule,
    ScheduleEvery,
    sendNotification,
    Visibility,
  } = await import('@tauri-apps/plugin-notification')

  try {
    await createChannel({
      id: CHANNEL_ID,
      name: 'Lembretes financeiros',
      description: 'Lembretes para manter entradas e despesas atualizadas no Pingo',
      importance: Importance.Default,
      visibility: Visibility.Private,
      vibration: true,
    })
  } catch {
    // O canal já pode existir no Android.
  }

  await cancel([REMINDER_ID]).catch(() => undefined)
  sendNotification({
    id: REMINDER_ID,
    channelId: CHANNEL_ID,
    title: 'Pingo · Hora de atualizar',
    body: 'Você mexeu no seu dinheiro? Vem atualizar aqui!',
    schedule: Schedule.every(ScheduleEvery.Day, frequencyDays, true),
    autoCancel: true,
  })
}

export async function scheduleRecurringRuleNotification(rule: RecurringRule, currency: CurrencyCode, requestPermission = false) {
  if (!rule.reminderEnabled) return
  const permitted = requestPermission ? await ensurePermission() : await hasPermissionWithoutPrompt()
  if (!permitted) {
    if (requestPermission) throw new Error('Permissão de notificações não concedida')
    return
  }
  if (!isTauriRuntime()) return

  const { cancel, createChannel, Importance, Schedule, sendNotification, Visibility } = await import('@tauri-apps/plugin-notification')
  try {
    await createChannel({
      id: CHANNEL_ID,
      name: 'Lembretes financeiros',
      description: 'Salários, assinaturas e contas fixas do Pingo',
      importance: Importance.High,
      visibility: Visibility.Private,
      vibration: true,
    })
  } catch {
    // O canal pode existir no Android.
  }
  const id = recurringNotificationId(rule.id)
  await cancel([id]).catch(() => undefined)
  const copy = recurringNotificationCopy(rule, currency)
  sendNotification({
    id,
    channelId: CHANNEL_ID,
    ...copy,
    schedule: Schedule.interval({ day: rule.dayOfMonth, hour: 9, minute: 0 }, true),
    autoCancel: true,
  })
}

export async function cancelRecurringRuleNotification(ruleId: string) {
  if (!isTauriRuntime()) return
  const { cancel } = await import('@tauri-apps/plugin-notification')
  await cancel([recurringNotificationId(ruleId)]).catch(() => undefined)
}

export async function maybeNotifyDueRecurringRules(rules: RecurringRule[], currency: CurrencyCode) {
  const enabledRules = rules.filter((rule) => rule.reminderEnabled)
  if (!enabledRules.length || !(await hasPermissionWithoutPrompt())) return

  const today = localDateKey(new Date())
  let log: Record<string, string> = {}
  try { log = JSON.parse(localStorage.getItem(RECURRING_NOTIFICATION_LOG_KEY) ?? '{}') as Record<string, string> } catch { /* vazio */ }

  for (const rule of enabledRules) {
    if (log[rule.id] === today) continue
    const copy = recurringNotificationCopy(rule, currency)
    if (isTauriRuntime()) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification')
      sendNotification({ id: recurringNotificationId(rule.id) + 1_000_000, channelId: CHANNEL_ID, ...copy, autoCancel: true })
    } else {
      const notification = new Notification(copy.title, { body: copy.body, tag: `pingo-recurring-${rule.id}` })
      notification.onclick = () => { window.focus(); notification.close() }
    }
    log[rule.id] = today
  }
  localStorage.setItem(RECURRING_NOTIFICATION_LOG_KEY, JSON.stringify(log))
}

async function sendImmediateNotification(body = messageForToday()) {
  if (isTauriRuntime()) {
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    sendNotification({
      id: TEST_ID,
      channelId: CHANNEL_ID,
      title: 'Pingo · Tudo certo!',
      body,
      autoCancel: true,
    })
    return
  }

  const notification = new Notification('Pingo · Hora de atualizar', {
    body,
    tag: 'pingo-money-reminder',
  })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

export async function enableMoneyReminders(frequencyDays: ReminderFrequencyDays): Promise<ReminderSettings> {
  if (!(await ensurePermission())) throw new Error('Permissão de notificações não concedida')

  if (isTauriRuntime()) await scheduleNativeReminder(frequencyDays)
  await sendImmediateNotification('Lembretes ativados. O Pingo ajuda você a manter tudo em dia.')

  const settings: ReminderSettings = {
    enabled: true,
    frequencyDays,
    lastWebNotificationAt: new Date().toISOString(),
  }
  saveReminderSettings(settings)
  return settings
}

export async function disableMoneyReminders(): Promise<ReminderSettings> {
  if (isTauriRuntime()) {
    const { cancel } = await import('@tauri-apps/plugin-notification')
    await cancel([REMINDER_ID]).catch(() => undefined)
  }

  const settings = { ...loadReminderSettings(), enabled: false }
  saveReminderSettings(settings)
  return settings
}

export async function sendReminderTest() {
  if (!(await ensurePermission())) throw new Error('Permissão de notificações não concedida')
  await sendImmediateNotification()
}

export async function maybeSendWebReminder() {
  if (isTauriRuntime() || !('Notification' in window)) return
  const settings = loadReminderSettings()
  if (!settings.enabled || Notification.permission !== 'granted') return

  const last = settings.lastWebNotificationAt ? new Date(settings.lastWebNotificationAt).getTime() : 0
  const interval = settings.frequencyDays * 24 * 60 * 60 * 1000
  if (Date.now() - last < interval) return

  await sendImmediateNotification()
  saveReminderSettings({ ...settings, lastWebNotificationAt: new Date().toISOString() })
}

export function startWebReminderWatcher() {
  void maybeSendWebReminder()
  const interval = window.setInterval(() => void maybeSendWebReminder(), 60 * 60 * 1000)
  return () => window.clearInterval(interval)
}
