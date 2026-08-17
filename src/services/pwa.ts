import { readonly, ref } from 'vue'
import { isTauriRuntime } from './financeRepository'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const canInstall = ref(false)
const updateAvailable = ref(false)
let deferredInstall: InstallPromptEvent | null = null
let registration: ServiceWorkerRegistration | null = null
let initialized = false

function handleOnline() { online.value = true }
function handleOffline() { online.value = false }
function handleInstallPrompt(event: Event) {
  event.preventDefault()
  deferredInstall = event as InstallPromptEvent
  canInstall.value = true
}
function handleInstalled() {
  deferredInstall = null
  canInstall.value = false
}

export async function setupWebApp() {
  if (initialized || typeof window === 'undefined' || isTauriRuntime()) return () => undefined
  initialized = true
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('beforeinstallprompt', handleInstallPrompt)
  window.addEventListener('appinstalled', handleInstalled)

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('/sw.js')
      if (registration.waiting) updateAvailable.value = true
      registration.addEventListener('updatefound', () => {
        const worker = registration?.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            updateAvailable.value = true
          }
        })
      })
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    } catch {
      // O app continua funcional sem cache offline quando o navegador bloqueia service workers.
    }
  }

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
    window.removeEventListener('appinstalled', handleInstalled)
    initialized = false
  }
}

export async function installWebApp() {
  if (!deferredInstall) return false
  await deferredInstall.prompt()
  const { outcome } = await deferredInstall.userChoice
  if (outcome === 'accepted') handleInstalled()
  return outcome === 'accepted'
}

export function applyWebUpdate() {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
}

export const isOnline = readonly(online)
export const canInstallWebApp = readonly(canInstall)
export const hasWebUpdate = readonly(updateAvailable)
