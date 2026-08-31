import { describe, expect, it } from 'vitest'
import { calculateKeyboardViewport } from '../mobileViewport'

describe('mobile viewport', () => {
  it('uses the visual viewport to keep a modal above the native keyboard', () => {
    expect(calculateKeyboardViewport(844, { height: 476, offsetTop: 22 })).toEqual({
      height: 476,
      offsetTop: 22,
      keyboardHeight: 346,
    })
  })

  it('falls back to the full layout viewport when the API is unavailable', () => {
    expect(calculateKeyboardViewport(720, null)).toEqual({
      height: 720,
      offsetTop: 0,
      keyboardHeight: 0,
    })
  })

  it('keeps a non-zero visual height for a bottom sheet while the keyboard is open', () => {
    expect(calculateKeyboardViewport(780, { height: 356, offsetTop: 0 })).toMatchObject({
      height: 356,
      offsetTop: 0,
      keyboardHeight: 424,
    })
  })

  it('does not make the modal taller than a very small landscape viewport', () => {
    expect(calculateKeyboardViewport(430, { height: 248, offsetTop: 0 })).toMatchObject({
      height: 248,
      offsetTop: 0,
    })
  })
})
