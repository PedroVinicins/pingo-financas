import type {
  DashboardLayout,
  DashboardWidgetId,
  DashboardWidgetPreference,
  DashboardWidgetSize,
} from '../types/finance'

export const DASHBOARD_WIDGETS: Record<DashboardWidgetId, { label: string; description: string }> = {
  net_worth: { label: 'Patrimônio', description: 'Tudo que você tem, incluindo os porquinhos.' },
  available_balance: { label: 'Saldo da carteira', description: 'Dinheiro disponível para usar agora.' },
  vault_total: { label: 'Guardado', description: 'Total reservado nos porquinhos.' },
  month_expenses: { label: 'Gastos do mês', description: 'Quanto saiu no mês atual.' },
  daily_budget: { label: 'Posso gastar hoje', description: 'Limite diário sugerido pelo Pingo.' },
  month_balance: { label: 'Resultado do mês', description: 'Entradas menos gastos do mês.' },
  recurring: { label: 'Contas recorrentes', description: 'Próximos compromissos automáticos.' },
  insights: { label: 'Leituras do Pingo', description: 'Alertas e sugestões sobre suas finanças.' },
  history: { label: 'Movimentações', description: 'Seu histórico recente.' },
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [
    { id: 'net_worth', visible: true, size: 'large' },
    { id: 'available_balance', visible: true, size: 'small' },
    { id: 'vault_total', visible: true, size: 'small' },
    { id: 'month_expenses', visible: true, size: 'small' },
    { id: 'daily_budget', visible: true, size: 'small' },
    { id: 'month_balance', visible: true, size: 'medium' },
    { id: 'recurring', visible: true, size: 'large' },
    { id: 'insights', visible: true, size: 'large' },
    { id: 'history', visible: true, size: 'large' },
  ],
}

const VALID_SIZES: DashboardWidgetSize[] = ['small', 'medium', 'large']

export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  const source = typeof value === 'object' && value && Array.isArray((value as DashboardLayout).widgets)
    ? (value as DashboardLayout).widgets
    : []
  const seen = new Set<DashboardWidgetId>()
  const widgets: DashboardWidgetPreference[] = []
  for (const item of source) {
    if (!item || !(item.id in DASHBOARD_WIDGETS) || seen.has(item.id)) continue
    seen.add(item.id)
    widgets.push({
      id: item.id,
      visible: item.visible !== false,
      size: VALID_SIZES.includes(item.size) ? item.size : 'medium',
    })
  }
  for (const item of DEFAULT_DASHBOARD_LAYOUT.widgets) {
    if (!seen.has(item.id)) widgets.push({ ...item })
  }
  return { widgets }
}

export function cloneDashboardLayout(layout: DashboardLayout): DashboardLayout {
  return { widgets: layout.widgets.map((widget) => ({ ...widget })) }
}
