import { describe, expect, it } from 'vitest'
import { greetingForHour, ShakeDetector } from '../deviceExperience'

describe('device experience', () => {
  it('uses the local-hour greeting boundaries', () => {
    expect(greetingForHour(4)).toBe('Boa noite')
    expect(greetingForHour(5)).toBe('Bom dia')
    expect(greetingForHour(12)).toBe('Boa tarde')
    expect(greetingForHour(18)).toBe('Boa noite')
  })

  it('requires two abrupt movements and applies a cooldown', () => {
    const detector = new ShakeDetector('medium')
    expect(detector.register({ x: 0, y: 0, z: 9 }, 0)).toBe(false)
    expect(detector.register({ x: 25, y: 0, z: 9 }, 100)).toBe(false)
    expect(detector.register({ x: -25, y: 0, z: 9 }, 300)).toBe(true)
    expect(detector.register({ x: 25, y: 0, z: 9 }, 500)).toBe(false)
    expect(detector.register({ x: -25, y: 0, z: 9 }, 700)).toBe(false)
  })

  it('recognizes realistic movements at medium sensitivity', () => {
    const detector = new ShakeDetector('medium')
    expect(detector.register({ x: 0, y: 0, z: 9.8 }, 0)).toBe(false)
    expect(detector.register({ x: 8, y: 8, z: 3 }, 120)).toBe(false)
    expect(detector.register({ x: -7, y: -7, z: 14 }, 420)).toBe(true)
  })
})
