import { beforeEach, describe, expect, it } from 'vitest'
import { factoryReset } from '../financeRepository'

describe('factory reset on the Web', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('removes every Pingo key without touching unrelated sites', async () => {
    localStorage.setItem('cashew-clone:transactions', '[{"id":"transaction"}]')
    localStorage.setItem('pingo:vaults', '[{"id":"vault"}]')
    localStorage.setItem('pingo:dashboard-layout:recovery:1', '{broken}')
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('another-app:preference', 'preserve-me')
    sessionStorage.setItem('pingo:active-view', 'wallet')

    await factoryReset()

    expect(localStorage.getItem('cashew-clone:transactions')).toBeNull()
    expect(localStorage.getItem('pingo:vaults')).toBeNull()
    expect(localStorage.getItem('pingo:dashboard-layout:recovery:1')).toBeNull()
    expect(localStorage.getItem('theme')).toBeNull()
    expect(sessionStorage.getItem('pingo:active-view')).toBeNull()
    expect(localStorage.getItem('another-app:preference')).toBe('preserve-me')
  })
})
