import { isTauriRuntime } from './financeRepository'
import type { RecurringRule } from '../types/finance'
import { localDateKey } from './recurringDates'

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

function recurringNotificationId(id: string) {
  let hash = 0
  for (const character of id) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return 50_000 + Math.abs(hash % 900_000)
}

function recurringCopy(rule: RecurringRule) {
  return rule.kind === 'income'
    ? { title: 'Pingo · Opa, já pingou seu salário?', body: `${rule.description} está previsto para hoje. Confirme quando cair.` }
    : { title: 'Pingo · Se pinga, me lembre de pagar!', body: `${rule.description} vence hoje. Toque para confirmar quando pagar.` }
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

export async function scheduleRecurringRuleNotification(rule: RecurringRule, requestPermission = false) {
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
  const copy = recurringCopy(rule)
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

export async function maybeNotifyDueRecurringRules(rules: RecurringRule[]) {
  const enabledRules = rules.filter((rule) => rule.reminderEnabled)
  if (!enabledRules.length || !(await hasPermissionWithoutPrompt())) return

  const today = localDateKey(new Date())
  let log: Record<string, string> = {}
  try { log = JSON.parse(localStorage.getItem(RECURRING_NOTIFICATION_LOG_KEY) ?? '{}') as Record<string, string> } catch { /* vazio */ }

  for (const rule of enabledRules) {
    if (log[rule.id] === today) continue
    const copy = recurringCopy(rule)
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
