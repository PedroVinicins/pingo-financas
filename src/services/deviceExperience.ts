import type { ShakeSensitivity } from '../types/finance'

export interface MotionVector { x: number; y: number; z: number }

const SHAKE_THRESHOLD: Record<ShakeSensitivity, number> = { low: 27, medium: 20, high: 14 }

export function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export class ShakeDetector {
  private previous: MotionVector | null = null
  private lastPeakAt = 0
  private peakCount = 0
  private lastTriggerAt = -Infinity

  constructor(private sensitivity: ShakeSensitivity = 'medium') {}

  register(sample: MotionVector, timestamp: number) {
    if (!this.previous) { this.previous = sample; return false }
    const delta = Math.hypot(
      sample.x - this.previous.x,
      sample.y - this.previous.y,
      sample.z - this.previous.z,
    )
    this.previous = sample
    if (delta < SHAKE_THRESHOLD[this.sensitivity]) return false
    this.peakCount = timestamp - this.lastPeakAt <= 500 ? this.peakCount + 1 : 1
    this.lastPeakAt = timestamp
    if (this.peakCount < 2 || timestamp - this.lastTriggerAt < 2_500) return false
    this.peakCount = 0
    this.lastTriggerAt = timestamp
    return true
  }
}

interface MotionPermissionEvent extends DeviceMotionEvent {
  accelerationIncludingGravity: DeviceMotionEventAcceleration | null
}

type MotionPermissionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export async function requestMotionPermission() {
  const constructor = window.DeviceMotionEvent as MotionPermissionConstructor | undefined
  if (!constructor) throw new Error('Este aparelho não oferece acesso ao sensor de movimento.')
  if (typeof constructor.requestPermission === 'function') {
    const result = await constructor.requestPermission()
    if (result !== 'granted') throw new Error('Permissão de movimento não concedida.')
  }
}

export function startShakeListener(onShake: () => void, sensitivity: ShakeSensitivity) {
  const detector = new ShakeDetector(sensitivity)
  const listener = (event: DeviceMotionEvent) => {
    const acceleration = (event as MotionPermissionEvent).accelerationIncludingGravity
    if (!acceleration || acceleration.x === null || acceleration.y === null || acceleration.z === null) return
    if (detector.register({ x: acceleration.x, y: acceleration.y, z: acceleration.z }, performance.now())) onShake()
  }
  window.addEventListener('devicemotion', listener)
  return () => window.removeEventListener('devicemotion', listener)
}

export type VoiceShortcut = 'expense' | 'wallet' | 'vaults' | 'dashboard' | null

export function interpretVoiceShortcut(transcript: string): VoiceShortcut {
  const text = transcript.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\b(?:novo|registrar|adicionar|anotar)\b.*\b(?:gasto|despesa)\b|\b(?:gasto|despesa)\b/.test(text)) return 'expense'
  if (/\b(?:carteira|cartao|cartoes)\b/.test(text)) return 'wallet'
  if (/\b(?:porquinho|porquinhos|cofre|cofres|reserva)\b/.test(text)) return 'vaults'
  if (/\b(?:resumo|inicio|painel|saldo)\b/.test(text)) return 'dashboard'
  return null
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export function startVoiceShortcut(onResult: (shortcut: VoiceShortcut) => void) {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  if (!Constructor) throw new Error('Atalhos de voz não são compatíveis com este navegador.')
  const recognition = new Constructor()
  recognition.lang = 'pt-BR'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onresult = (event) => onResult(interpretVoiceShortcut(event.results[0]?.[0]?.transcript ?? ''))
  recognition.start()
  return () => recognition.stop()
}

