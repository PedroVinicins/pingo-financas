import type { ShakeSensitivity } from '../types/finance'

export interface MotionVector { x: number; y: number; z: number }

const SHAKE_THRESHOLD: Record<ShakeSensitivity, number> = { low: 18, medium: 12, high: 8 }

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
    this.peakCount = timestamp - this.lastPeakAt <= 800 ? this.peakCount + 1 : 1
    this.lastPeakAt = timestamp
    if (this.peakCount < 2 || timestamp - this.lastTriggerAt < 2_200) return false
    this.peakCount = 0
    this.lastTriggerAt = timestamp
    return true
  }
}

type MotionPermissionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export async function requestMotionPermission() {
  const constructor = window.DeviceMotionEvent as MotionPermissionConstructor | undefined
  if (!constructor && !('ondevicemotion' in window)) throw new Error('Este aparelho não oferece acesso ao sensor de movimento.')
  if (constructor && typeof constructor.requestPermission === 'function') {
    const result = await constructor.requestPermission()
    if (result !== 'granted') throw new Error('Permissão de movimento não concedida.')
  }
}

export function startShakeListener(onShake: () => void, sensitivity: ShakeSensitivity) {
  const detector = new ShakeDetector(sensitivity)
  const listener = (event: DeviceMotionEvent) => {
    if (document.visibilityState === 'hidden') return
    const linear = event.acceleration
    const acceleration = linear?.x !== null && linear?.y !== null && linear?.z !== null
      ? linear
      : event.accelerationIncludingGravity
    if (!acceleration || acceleration.x === null || acceleration.y === null || acceleration.z === null) return
    if (detector.register({ x: acceleration.x, y: acceleration.y, z: acceleration.z }, performance.now())) onShake()
  }
  window.addEventListener('devicemotion', listener, { passive: true })
  return () => window.removeEventListener('devicemotion', listener)
}
