<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, LockKeyhole, RefreshCw, Sparkles, WifiOff, X } from 'lucide-vue-next'
import DashboardView from './views/DashboardView.vue'
import ExpensesSavingsView from './views/ExpensesSavingsView.vue'
import AccountsView from './views/AccountsView.vue'
import AppSettings from './components/AppSettings.vue'
import AppFeedback from './components/AppFeedback.vue'
import AppLockGate from './components/AppLockGate.vue'
import AddTransactionModal from './components/AddTransactionModal.vue'
import QuickExpenseSheet from './components/QuickExpenseSheet.vue'
import MobileBottomNav, { type PrimaryView } from './components/MobileBottomNav.vue'
import DesktopSidebar from './components/DesktopSidebar.vue'
import { useFinanceStore } from './stores/financeStore'
import { defaultCategories } from './data/defaultCategories'
import { listenForQuickLaunch } from './services/quickLaunch'
import { startShakeListener } from './services/deviceExperience'
import { maybeNotifyAccountAnalysis, startWebReminderWatcher } from './services/notifications'
import { analyzeAccount } from './services/accountAnalysis'
import { privateCurrencyCents } from './services/currency'
import { applyWebUpdate, canInstallWebApp, hasWebUpdate, installWebApp, isOnline, setupWebApp } from './services/pwa'
import type { NewRecurringRuleInput, NewTransactionInput, QuickLaunchAction, TransactionType } from './types/finance'
import {
  APP_LOCK_BACKGROUND_DELAY_MS, APP_LOCK_CHANGED_EVENT, authenticateAppLockBiometric,
  biometricErrorMessage, getAppLockConfig, getBiometricAvailability, verifyAppLockPin, type AppLockConfig,
} from './services/appLock'

const store = useFinanceStore()
const legacyView: Record<string, PrimaryView> = {
  dashboard: 'home', expenses: 'analytics', wallet: 'accounts', vaults: 'accounts',
  home: 'home', analytics: 'analytics', accounts: 'accounts', settings: 'settings',
}
const storedView = (() => { try { return sessionStorage.getItem('pingo:active-view') ?? '' } catch { return '' } })()
const activeView = ref<PrimaryView>(legacyView[storedView] ?? 'home')
const accountsSection = ref<'wallet' | 'vaults'>(storedView === 'vaults' ? 'vaults' : 'wallet')
const showQuickExpense = ref(false)
const showTransactionComposer = ref(false)
const composerKind = ref<TransactionType>('expense')
const composerFlow = ref<'transaction' | 'recurring' | 'vault'>('transaction')
const quickCardId = ref<string | undefined>()
const walletFocusCardId = ref<string | undefined>()
const bootError = ref('')
const securityError = ref('')
const securityReady = ref(false)
const appLocked = ref(false)
const privacyCovered = ref(false)
const unlockBusy = ref(false)
const unlockError = ref('')
const retryAfterSeconds = ref(0)
const appLockConfig = ref<AppLockConfig>({ enabled: false, biometricEnabled: false })
const biometricAvailable = ref(false)
const biometricLabel = ref('Biometria')
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
const pageSwipeOffset = ref(0)
const pageSwipeAnimating = ref(false)
let touchStart: { x: number; y: number; target: EventTarget | null } | null = null
let removeDeepLinkListener: (() => void) | undefined
let stopReminderWatcher: (() => void) | undefined
let stopWebApp: (() => void) | undefined
let recurringWatcher: number | undefined
let pingoMessageTimer: number | undefined
let stopShakeListener: (() => void) | undefined
let removeSystemThemeListener: (() => void) | undefined
let backgroundedAt: number | null = null
let retryTimer: number | undefined
let analysisNotificationTimer: number | undefined
let pageSwipeTimer: number | undefined
let pageSwipeFrame: number | undefined
let pendingPageSwipeOffset = 0
let biometricPromptOpen = false

const navigationOrder: PrimaryView[] = ['accounts', 'home', 'analytics', 'settings']
const pageTitle = computed(() => ({ accounts: 'Contas', home: 'Início', analytics: 'Análises', settings: 'Ajustes' })[activeView.value])
const displayName = computed(() => store.preferences.displayName || 'Você')
const isDark = computed(() => store.preferences.themeMode === 'dark'
  || (store.preferences.themeMode === 'system' && systemDark.value))
const pageSwipeStyle = computed(() => {
  if (!pageSwipeAnimating.value && pageSwipeOffset.value === 0) return {}
  return {
    transform: `translate3d(${pageSwipeOffset.value}px, 0, 0)`,
    backfaceVisibility: 'hidden' as const,
    transition: pageSwipeAnimating.value
      ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
      : 'none',
  }
})

function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
}
function navigate(view: PrimaryView, smooth = true) {
  if (view !== 'accounts') walletFocusCardId.value = undefined
  activeView.value = view
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' })
}
function openComposer(kind: TransactionType = 'expense', flow: 'transaction' | 'recurring' | 'vault' = 'transaction') {
  composerKind.value = kind
  composerFlow.value = flow
  showTransactionComposer.value = true
}
function openQuickExpense(cardId?: string) { quickCardId.value = cardId; showQuickExpense.value = true }
function closeQuickExpense() { showQuickExpense.value = false; quickCardId.value = undefined }
function updateSwipeOffset(value: number) {
  pendingPageSwipeOffset = value
  if (pageSwipeFrame !== undefined) return
  pageSwipeFrame = window.requestAnimationFrame(() => {
    pageSwipeFrame = undefined
    pageSwipeOffset.value = pendingPageSwipeOffset
  })
}
function cancelSwipeFrame() {
  if (pageSwipeFrame !== undefined) window.cancelAnimationFrame(pageSwipeFrame)
  pageSwipeFrame = undefined
}
function handleTouchStart(event: TouchEvent) {
  const point = event.touches[0]
  const element = event.target instanceof Element ? event.target : null
  if (!point || element?.closest('input, textarea, select, button, a, [role="slider"], [data-no-page-swipe]')) {
    touchStart = null
    return
  }
  if (pageSwipeTimer !== undefined) window.clearTimeout(pageSwipeTimer)
  cancelSwipeFrame()
  pageSwipeAnimating.value = false
  pageSwipeOffset.value = 0
  touchStart = { x: point.clientX, y: point.clientY, target: event.target }
}
function handleTouchMove(event: TouchEvent) {
  const point = event.touches[0]
  if (!touchStart || !point) return
  const deltaX = point.clientX - touchStart.x
  const deltaY = point.clientY - touchStart.y
  if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return
  const index = navigationOrder.indexOf(activeView.value)
  const nextIndex = deltaX < 0 ? index + 1 : index - 1
  const hasDestination = nextIndex >= 0 && nextIndex < navigationOrder.length
  const resistance = hasDestination ? 0.3 : 0.08
  updateSwipeOffset(Math.max(-84, Math.min(84, deltaX * resistance)))
}
function handleTouchEnd(event: TouchEvent) {
  cancelSwipeFrame()
  if (!touchStart || event.changedTouches.length === 0) {
    pageSwipeAnimating.value = true
    pageSwipeOffset.value = 0
    return
  }
  const origin = touchStart
  touchStart = null
  const point = event.changedTouches[0]
  const deltaX = point.clientX - origin.x
  const deltaY = point.clientY - origin.y
  pageSwipeAnimating.value = true
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) {
    pageSwipeOffset.value = 0
    return
  }
  const index = navigationOrder.indexOf(activeView.value)
  const nextIndex = deltaX < 0 ? index + 1 : index - 1
  if (nextIndex < 0 || nextIndex >= navigationOrder.length) {
    pageSwipeOffset.value = 0
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pageSwipeAnimating.value = false
    pageSwipeOffset.value = 0
    navigate(navigationOrder[nextIndex], false)
    return
  }
  pageSwipeOffset.value = deltaX < 0 ? -84 : 84
  pageSwipeTimer = window.setTimeout(() => {
    pageSwipeTimer = undefined
    navigate(navigationOrder[nextIndex], false)
    pageSwipeAnimating.value = false
    pageSwipeOffset.value = deltaX < 0 ? 26 : -26
    requestAnimationFrame(() => {
      pageSwipeAnimating.value = true
      pageSwipeOffset.value = 0
    })
  }, 90)
}
function handleTouchCancel() {
  cancelSwipeFrame()
  touchStart = null
  pageSwipeAnimating.value = true
  pageSwipeOffset.value = 0
}
function handlePageSwipeTransitionEnd(event: TransitionEvent) {
  if (event.propertyName !== 'transform' || pageSwipeOffset.value !== 0) return
  pageSwipeAnimating.value = false
}
function handleLaunch(action: QuickLaunchAction) {
  if (action.type === 'expense') {
    if (action.cardId) openQuickExpense(action.cardId)
    else openComposer('expense', 'transaction')
  }
  if (action.type === 'income') openComposer('income', 'transaction')
  if (action.type === 'wallet') { accountsSection.value = 'wallet'; navigate('accounts'); walletFocusCardId.value = action.cardId }
  if (action.type === 'vaults') { accountsSection.value = 'vaults'; navigate('accounts') }
  if (action.type === 'dashboard') navigate('home')
}
async function saveQuickExpense(input: NewTransactionInput) {
  try { await store.createTransaction(input); closeQuickExpense() }
  catch (cause) { store.reportError(cause, 'Não foi possível registrar o gasto.') }
}
async function saveTransaction(input: NewTransactionInput) {
  try { await store.createTransaction(input); showTransactionComposer.value = false }
  catch (cause) { store.reportError(cause, 'Não foi possível registrar a movimentação.') }
}
async function saveRecurring(input: NewRecurringRuleInput) {
  try { await store.createRecurringRule(input); showTransactionComposer.value = false; store.showFeedback('Piloto Mensal configurado.', 'success') }
  catch (cause) { store.reportError(cause, 'Não foi possível criar a recorrência.') }
}
async function sendToVault(input: { vaultId: string; amount: string }) {
  try { await store.moveVaultMoney({ id: input.vaultId, kind: 'deposit', amount: input.amount }); showTransactionComposer.value = false }
  catch (cause) { store.reportError(cause, 'Não foi possível enviar ao Porquinho.') }
}
async function initializeApp() {
  bootError.value = ''
  try {
    await store.initialize(defaultCategories)
    removeDeepLinkListener ??= await listenForQuickLaunch(handleLaunch)
    stopReminderWatcher ??= startWebReminderWatcher()
    recurringWatcher ??= window.setInterval(() => {
      void store.processScheduledAutomation()
        .then(queueAnalysisNotification)
        .catch((cause) => store.reportError(cause, 'Não foi possível atualizar as automações mensais.'))
    }, 60 * 60 * 1000)
    queueAnalysisNotification()
  } catch (cause) { bootError.value = cause instanceof Error ? cause.message : 'Não foi possível abrir seus dados.' }
}

function currentAccountAnalysis() {
  const now = new Date()
  return analyzeAccount({
    transactions: store.transactions,
    categories: store.categories,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    formatMoney: (value) => privateCurrencyCents(value, store.preferences.currency, store.balanceHidden),
  })
}
function queueAnalysisNotification() {
  if (analysisNotificationTimer !== undefined) window.clearTimeout(analysisNotificationTimer)
  if (!store.initialized || !store.preferences.weeklySummaryNotifications) return
  analysisNotificationTimer = window.setTimeout(() => {
    analysisNotificationTimer = undefined
    void maybeNotifyAccountAnalysis(
      currentAccountAnalysis(), store.preferences.currency, store.balanceHidden,
    ).catch(() => undefined)
  }, 800)
}

function clearRetryTimer() {
  if (retryTimer !== undefined) window.clearInterval(retryTimer)
  retryTimer = undefined
}
function startRetryCountdown(seconds: number) {
  clearRetryTimer()
  retryAfterSeconds.value = seconds
  if (seconds <= 0) return
  retryTimer = window.setInterval(() => {
    retryAfterSeconds.value = Math.max(0, retryAfterSeconds.value - 1)
    if (retryAfterSeconds.value === 0) clearRetryTimer()
  }, 1_000)
}
async function finishUnlock() {
  appLocked.value = false
  privacyCovered.value = false
  unlockError.value = ''
  startRetryCountdown(0)
  if (!store.initialized && !store.isInitializing) await initializeApp()
}
async function unlockWithPin(pin: string) {
  unlockBusy.value = true
  unlockError.value = ''
  try {
    const result = await verifyAppLockPin(pin)
    if (result.valid) await finishUnlock()
    else {
      startRetryCountdown(result.retryAfterSeconds)
      unlockError.value = result.retryAfterSeconds ? '' : 'PIN incorreto. Tente novamente.'
    }
  } catch (cause) { unlockError.value = cause instanceof Error ? cause.message : String(cause) }
  finally { unlockBusy.value = false }
}
async function unlockWithBiometric() {
  if (!appLocked.value || !biometricAvailable.value || unlockBusy.value || biometricPromptOpen) return
  biometricPromptOpen = true
  unlockBusy.value = true
  unlockError.value = ''
  try { await authenticateAppLockBiometric(); await finishUnlock() }
  catch (cause) { unlockError.value = `${biometricErrorMessage(cause, biometricLabel.value)} Use o PIN ou tente novamente.` }
  finally { unlockBusy.value = false; biometricPromptOpen = false }
}
async function refreshBiometricAvailability() {
  const availability = await getBiometricAvailability()
  biometricAvailable.value = availability.available && appLockConfig.value.biometricEnabled
  biometricLabel.value = availability.label
}
async function initializeSecurity() {
  securityReady.value = false
  securityError.value = ''
  try {
    appLockConfig.value = await getAppLockConfig()
    appLocked.value = appLockConfig.value.enabled
    if (appLockConfig.value.biometricEnabled) await refreshBiometricAvailability()
  } catch (cause) {
    securityError.value = cause instanceof Error ? cause.message : 'Não foi possível conferir a proteção local.'
  } finally { securityReady.value = true }
  if (securityError.value) return
  if (appLocked.value && biometricAvailable.value) window.setTimeout(() => void unlockWithBiometric(), 250)
  else if (!appLocked.value) await initializeApp()
}
function handleVisibilityChange() {
  if (!appLockConfig.value.enabled) { privacyCovered.value = false; return }
  if (document.visibilityState === 'hidden') {
    backgroundedAt = Date.now()
    privacyCovered.value = true
    return
  }
  const elapsed = backgroundedAt === null ? 0 : Date.now() - backgroundedAt
  backgroundedAt = null
  if (elapsed >= APP_LOCK_BACKGROUND_DELAY_MS) {
    appLocked.value = true
    unlockError.value = ''
    void refreshBiometricAvailability().then(() => {
      if (biometricAvailable.value) window.setTimeout(() => void unlockWithBiometric(), 250)
    })
  }
  privacyCovered.value = false
}
function handleAppLockChange(event: Event) {
  appLockConfig.value = (event as CustomEvent<AppLockConfig>).detail
  if (!appLockConfig.value.enabled) { appLocked.value = false; biometricAvailable.value = false }
  else void refreshBiometricAvailability()
}
async function installApp() {
  if (await installWebApp()) store.showFeedback('Pingo instalado neste dispositivo.', 'success')
}

watch(activeView, (view) => {
  try { sessionStorage.setItem('pingo:active-view', view) } catch { /* mantém em memória */ }
  document.title = `${pageTitle.value} · Pingo`
}, { immediate: true })
watch(isDark, applyTheme, { immediate: true })
watch([() => store.pingoMessage, () => store.preferences.feedbackDurationMs], ([message, duration]) => {
  if (pingoMessageTimer !== undefined) window.clearTimeout(pingoMessageTimer)
  pingoMessageTimer = message ? window.setTimeout(() => store.dismissPingoMessage(), duration) : undefined
})
watch([() => store.preferences.shakeToExpenseEnabled, () => store.preferences.shakeSensitivity, activeView, showQuickExpense, showTransactionComposer, appLocked, privacyCovered], ([enabled, sensitivity, view, quickOpen, composerOpen, locked, covered]) => {
  stopShakeListener?.(); stopShakeListener = undefined
  if (enabled && view === 'home' && !quickOpen && !composerOpen && !locked && !covered) stopShakeListener = startShakeListener(() => openQuickExpense(), sensitivity)
}, { immediate: true })
watch([
  () => store.transactions.map((item) => `${item.id}:${item.kind}:${item.amount}:${item.date}:${item.occurredAt ?? ''}:${item.categoryId ?? ''}`).join('|'),
  () => store.categories.map((item) => `${item.id}:${item.name}:${item.kind}`).join('|'),
  () => store.preferences.weeklySummaryNotifications,
  () => store.preferences.currency,
  () => store.balanceHidden,
], queueAnalysisNotification)

onMounted(async () => {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent) => { systemDark.value = event.matches }
  query.addEventListener('change', listener)
  removeSystemThemeListener = () => query.removeEventListener('change', listener)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener(APP_LOCK_CHANGED_EVENT, handleAppLockChange)
  await initializeSecurity()
  stopWebApp = await setupWebApp()
})
onBeforeUnmount(() => {
  removeDeepLinkListener?.(); stopReminderWatcher?.(); stopWebApp?.(); removeSystemThemeListener?.()
  if (recurringWatcher) window.clearInterval(recurringWatcher)
  if (pingoMessageTimer !== undefined) window.clearTimeout(pingoMessageTimer)
  if (analysisNotificationTimer !== undefined) window.clearTimeout(analysisNotificationTimer)
  if (pageSwipeTimer !== undefined) window.clearTimeout(pageSwipeTimer)
  cancelSwipeFrame()
  clearRetryTimer()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener(APP_LOCK_CHANGED_EVENT, handleAppLockChange)
  stopShakeListener?.()
})
</script>

<template>
  <main v-if="!securityReady" class="fixed inset-0 z-[200] grid min-h-dvh place-items-center bg-hero px-6 text-center text-white"><div><img src="/pingo-icon.svg" alt="" class="mx-auto size-16 rounded-3xl" /><RefreshCw class="mx-auto mt-6 animate-spin text-violet-300" :size="24" /><h1 class="mt-3 text-xl font-extrabold">Protegendo seu Pingo</h1></div></main>
  <main v-else-if="securityError" class="fixed inset-0 z-[200] grid min-h-dvh place-items-center bg-hero px-6 text-center text-white"><div class="w-full max-w-sm"><LockKeyhole class="mx-auto text-rose-300" :size="32" /><h1 class="mt-4 text-2xl font-extrabold">Não foi possível conferir a proteção</h1><p class="mt-2 text-sm text-white/60">{{ securityError }}</p><button class="mt-6 min-h-12 cursor-pointer rounded-2xl bg-brand px-5 font-bold" @click="initializeSecurity"><RefreshCw :size="17" class="mr-1 inline" /> Tentar novamente</button></div></main>
  <main v-else-if="privacyCovered" class="fixed inset-0 z-[200] grid min-h-dvh place-items-center bg-hero px-6 text-center text-white"><div><img src="/pingo-icon.svg" alt="" class="mx-auto size-16 rounded-3xl" /><LockKeyhole class="mx-auto mt-6 text-violet-300" :size="24" /><h1 class="mt-3 text-xl font-extrabold">Conteúdo protegido</h1></div></main>
  <AppLockGate v-else-if="appLocked" :biometric-available="biometricAvailable" :biometric-label="biometricLabel" :busy="unlockBusy" :error="unlockError" :retry-after-seconds="retryAfterSeconds" @submit="unlockWithPin" @biometric="unlockWithBiometric" />
  <div v-else class="min-h-dvh overflow-x-clip bg-canvas pb-28 text-ink lg:pb-0" :class="store.preferences.economyMode ? 'pingo-economy' : ''">
    <a href="#main-content" class="fixed left-3 top-3 z-[150] -translate-y-24 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-surface transition focus:translate-y-0">Pular para o conteúdo</a>
    <div v-if="!isOnline" class="safe-top sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-300 px-4 py-2 text-center text-xs font-bold text-amber-950" role="status"><WifiOff :size="15" /> Sem internet — seus dados locais continuam disponíveis.</div>

    <DesktopSidebar v-if="store.initialized" :active-view="activeView" :display-name="displayName" @navigate="navigate" @add="openComposer" />

    <div v-if="store.initialized" class="fixed right-6 top-5 z-30 hidden items-center gap-2 lg:flex">
      <button v-if="canInstallWebApp" class="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3 text-xs font-bold" @click="installApp"><Download :size="16" /> Instalar</button>
    </div>

    <div v-if="hasWebUpdate" class="fixed inset-x-0 top-0 z-[70] bg-brand px-4 py-2 text-white lg:left-[248px]"><div class="mx-auto flex max-w-[1440px] items-center justify-between gap-3 text-xs font-bold"><span>Uma atualização do Pingo está pronta.</span><button class="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5" @click="applyWebUpdate"><RefreshCw :size="13" /> Atualizar</button></div></div>

    <main v-if="store.isInitializing" id="main-content" class="grid min-h-dvh place-items-center px-6 text-center lg:ml-[248px]">
      <div><img src="/pingo-icon.svg" alt="" class="mx-auto size-16 rounded-3xl" /><RefreshCw class="mx-auto mt-6 animate-spin text-brand" :size="24" /><h1 class="mt-3 text-xl font-extrabold">Abrindo seu Pingo</h1><p class="mt-1 text-sm text-subtle">Conferindo saldos, porquinhos e compromissos…</p></div>
    </main>
    <main v-else-if="bootError" id="main-content" class="grid min-h-dvh place-items-center px-6 py-12 text-center lg:ml-[248px]">
      <div class="pingo-card max-w-md p-7"><h1 class="text-2xl font-extrabold">Não foi possível abrir seus dados</h1><p class="mt-2 text-sm text-subtle">{{ bootError }}</p><button class="mt-6 rounded-2xl bg-brand px-5 py-3 font-bold text-white" @click="initializeApp"><RefreshCw :size="17" class="mr-1 inline" /> Tentar novamente</button><p class="mt-4 text-xs text-subtle">Nenhum dado foi apagado.</p></div>
    </main>

    <div
      v-else-if="store.initialized"
      id="main-content"
      class="min-w-0 touch-pan-y lg:ml-[248px]"
      :class="pageSwipeOffset !== 0 || pageSwipeAnimating ? 'will-change-transform' : ''"
      :style="pageSwipeStyle"
      @touchstart.passive="handleTouchStart"
      @touchmove.passive="handleTouchMove"
      @touchend.passive="handleTouchEnd"
      @touchcancel.passive="handleTouchCancel"
      @transitionend="handlePageSwipeTransitionEnd"
    >
      <AccountsView v-if="activeView === 'accounts'" :focus-card-id="walletFocusCardId" :initial-section="accountsSection" @quick-expense="openQuickExpense" />
      <DashboardView v-else-if="activeView === 'home'" @new-transaction="openComposer" @navigate="navigate" />
      <ExpensesSavingsView v-else-if="activeView === 'analytics'" />
      <AppSettings v-else embedded />
    </div>

    <MobileBottomNav v-if="store.initialized" :active-view="activeView" @navigate="navigate" />
    <AddTransactionModal v-if="showTransactionComposer && store.initialized" :key="`${composerKind}-${composerFlow}`" :categories="store.categories" :cards="store.debitCards" :vaults="store.vaults" :initial-kind="composerKind" :initial-flow="composerFlow" @close="showTransactionComposer = false" @save="saveTransaction" @save-recurring="saveRecurring" @send-to-vault="sendToVault" />
    <QuickExpenseSheet v-if="showQuickExpense && store.initialized" :key="quickCardId ?? 'generic'" :categories="store.categories" :cards="store.debitCards" :recent-category-ids="store.recentExpenseCategoryIds" :initial-card-id="quickCardId" @close="closeQuickExpense" @save="saveQuickExpense" />

    <Transition enter-active-class="transition duration-200 ease-pingo" enter-from-class="translate-y-4 opacity-0" leave-active-class="transition duration-200 ease-pingo" leave-to-class="translate-y-4 opacity-0">
      <aside v-if="store.pingoMessage" class="fixed bottom-28 left-4 right-4 z-[90] mx-auto flex max-w-md items-start gap-3 rounded-[1.4rem] border border-line bg-hero p-4 text-white shadow-float lg:bottom-6 lg:left-[264px]" role="status"><img src="/pingo-icon.svg" alt="" class="size-10 shrink-0 rounded-2xl" /><div class="min-w-0 flex-1"><p class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-300"><Sparkles :size="13" /> Pingo diz</p><p class="mt-1 text-sm font-semibold leading-relaxed">{{ store.pingoMessage }}</p></div><button class="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10" aria-label="Fechar mensagem" @click="store.dismissPingoMessage"><X :size="16" /></button></aside>
    </Transition>
    <AppFeedback />
  </div>
</template>

<style>
.pingo-economy *, .pingo-economy *::before, .pingo-economy *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
.pingo-economy .backdrop-blur-xl, .pingo-economy .backdrop-blur-sm, .pingo-economy .backdrop-blur-\[2px\] { backdrop-filter: none !important; }
</style>
