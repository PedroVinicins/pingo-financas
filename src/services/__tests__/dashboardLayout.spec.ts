import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_LAYOUT, normalizeDashboardLayout } from '../dashboardLayout'

describe('dashboard layout', () => {
  it('preserves a valid custom order and restores missing widgets', () => {
    const layout = normalizeDashboardLayout({ widgets: [
      { id: 'daily_budget', visible: true, size: 'large' },
      { id: 'net_worth', visible: false, size: 'small' },
    ] })
    expect(layout.widgets[0]).toEqual({ id: 'daily_budget', visible: true, size: 'large' })
    expect(layout.widgets[1]).toEqual({ id: 'net_worth', visible: false, size: 'small' })
    expect(layout.widgets).toHaveLength(DEFAULT_DASHBOARD_LAYOUT.widgets.length)
  })

  it('rejects duplicates, unknown widgets and invalid sizes', () => {
    const layout = normalizeDashboardLayout({ widgets: [
      { id: 'available_balance', visible: true, size: 'gigante' },
      { id: 'available_balance', visible: false, size: 'small' },
      { id: 'unknown', visible: true, size: 'large' },
    ] })
    expect(layout.widgets.filter((item) => item.id === 'available_balance')).toHaveLength(1)
    expect(layout.widgets[0].size).toBe('medium')
  })
})
