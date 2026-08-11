import { isTauriRuntime } from './financeRepository'

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
