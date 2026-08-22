import type { QuickLaunchAction } from '../types/finance'

export function parseQuickLaunchUrl(rawUrl: string): QuickLaunchAction | null {
  try {
    const url = new URL(rawUrl, window.location.origin)
    const action = url.protocol === 'pingo:'
      ? url.hostname || url.pathname.replace(/^\//, '')
      : url.searchParams.get('quick') || url.searchParams.get('view')
    const cardId = url.searchParams.get('card') || undefined

    if (action === 'expense' || action === 'gasto') return { type: 'expense', cardId }
    if (action === 'income' || action === 'entrada' || action === 'receita') return { type: 'income' }
    if (action === 'wallet' || action === 'carteira') return { type: 'wallet', cardId }
    if (action === 'vaults' || action === 'cofres') return { type: 'vaults' }
    if (action === 'dashboard' || action === 'home' || action === 'resumo') return { type: 'dashboard' }
    return null
  } catch {
    return null
  }
}

export function quickExpenseLink(cardId?: string) {
  return `pingo://expense${cardId ? `?card=${encodeURIComponent(cardId)}` : ''}`
}

export function quickWalletLink(cardId?: string) {
  return `pingo://wallet${cardId ? `?card=${encodeURIComponent(cardId)}` : ''}`
}

export interface PinCardShortcutResult {
  supported: boolean
  requested: boolean
}

export async function requestCardHomeShortcut(cardId: string, label: string): Promise<PinCardShortcutResult> {
  if (!('__TAURI_INTERNALS__' in window)) return { supported: false, requested: false }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<PinCardShortcutResult>('pin_card_shortcut', { cardId, label })
}

export async function listenForQuickLaunch(handler: (action: QuickLaunchAction) => void) {
  const webAction = parseQuickLaunchUrl(window.location.href)
  if (webAction) handler(webAction)

  if (!('__TAURI_INTERNALS__' in window)) return () => undefined

  try {
    const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
    const current = await getCurrent()
    current?.forEach((url) => {
      const action = parseQuickLaunchUrl(url)
      if (action) handler(action)
    })

    return await onOpenUrl((urls) => {
      urls.forEach((url) => {
        const action = parseQuickLaunchUrl(url)
        if (action) handler(action)
      })
    })
  } catch (error) {
    console.warn('Pingo: deep link indisponível neste ambiente', error)
    return () => undefined
  }
}
