<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, Mic, RefreshCw, Sparkles, WifiOff, X } from 'lucide-vue-next'
import DashboardView from './views/DashboardView.vue'
import ExpensesSavingsView from './views/ExpensesSavingsView.vue'
import AccountsView from './views/AccountsView.vue'
import AppSettings from './components/AppSettings.vue'
import AppFeedback from './components/AppFeedback.vue'
import AddTransactionModal from './components/AddTransactionModal.vue'
import QuickExpenseSheet from './components/QuickExpenseSheet.vue'
import MobileBottomNav, { type PrimaryView } from './components/MobileBottomNav.vue'
import DesktopSidebar from './components/DesktopSidebar.vue'
import { useFinanceStore } from './stores/financeStore'
import { defaultCategories } from './data/defaultCategories'
import { listenForQuickLaunch } from './services/quickLaunch'
import { startShakeListener, startVoiceShortcut, type VoiceShortcut } from './services/deviceExperience'
import { startWebReminderWatcher } from './services/notifications'
import { applyWebUpdate, canInstallWebApp, hasWebUpdate, installWebApp, isOnline, setupWebApp } from './services/pwa'
import type { NewRecurringRuleInput, NewTransactionInput, QuickLaunchAction, ThemeMode } from './types/finance'

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
const voiceListening = ref(false)
const quickCardId = ref<string | undefined>()
const walletFocusCardId = ref<string | undefined>()
const bootError = ref('')
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
let touchStart: { x: number; y: number; target: EventTarget | null } | null = null
let removeDeepLinkListener: (() => void) | undefined
let stopReminderWatcher: (() => void) | undefined
let stopWebApp: (() => void) | undefined
let recurringWatcher: number | undefined
let pingoMessageTimer: number | undefined
let stopShakeListener: (() => void) | undefined
let stopVoiceListener: (() => void) | undefined
let voiceTimer: number | undefined
let removeSystemThemeListener: (() => void) | undefined

const navigationOrder: PrimaryView[] = ['accounts', 'home', 'analytics', 'settings']
const pageTitle = computed(() => ({ accounts: 'Contas', home: 'Início', analytics: 'Análises', settings: 'Ajustes' })[activeView.value])
const displayName = computed(() => store.preferences.displayName || 'Você')
const isDark = computed(() => store.preferences.themeMode === 'dark'
  || (store.preferences.themeMode === 'system' && systemDark.value))

function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
}
function navigate(view: PrimaryView) {
  if (view !== 'accounts') walletFocusCardId.value = undefined
  activeView.value = view
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
function openComposer() { showTransactionComposer.value = true }
function openQuickExpense(cardId?: string) { quickCardId.value = cardId; showQuickExpense.value = true }
function closeQuickExpense() { showQuickExpense.value = false; quickCardId.value = undefined }
function handleTouchStart(event: TouchEvent) {
  const point = event.touches[0]
  touchStart = point ? { x: point.clientX, y: point.clientY, target: event.target } : null
}
function handleTouchEnd(event: TouchEvent) {
  if (!touchStart || event.changedTouches.length === 0) return
  const origin = touchStart
  touchStart = null
  const element = origin.target instanceof Element ? origin.target : null
  if (element?.closest('input, textarea, select, button, a, [role="slider"], [data-no-page-swipe]')) return
  const point = event.changedTouches[0]
  const deltaX = point.clientX - origin.x
  const deltaY = point.clientY - origin.y
  if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return
  const index = navigationOrder.indexOf(activeView.value)
  const nextIndex = deltaX < 0 ? index + 1 : index - 1
  if (nextIndex >= 0 && nextIndex < navigationOrder.length) navigate(navigationOrder[nextIndex])
}
function handleLaunch(action: QuickLaunchAction) {
  if (action.type === 'expense') openQuickExpense(action.cardId)
  if (action.type === 'wallet') { accountsSection.value = 'wallet'; navigate('accounts'); walletFocusCardId.value = action.cardId }
  if (action.type === 'vaults') { accountsSection.value = 'vaults'; navigate('accounts') }
  if (action.type === 'dashboard') navigate('home')
}
function handleVoiceShortcut(shortcut: VoiceShortcut) {
  voiceListening.value = false
  if (!shortcut) { store.showFeedback('Não entendi. Tente “novo gasto”, “carteira”, “porquinhos” ou “resumo”.', 'info'); return }
  handleLaunch({ type: shortcut })
}
function listenVoice() {
  stopVoiceListener?.()
  if (voiceTimer !== undefined) window.clearTimeout(voiceTimer)
  try {
    voiceListening.value = true
    stopVoiceListener = startVoiceShortcut(handleVoiceShortcut)
    voiceTimer = window.setTimeout(() => { stopVoiceListener?.(); stopVoiceListener = undefined; voiceListening.value = false }, 7_000)
  } catch (cause) { voiceListening.value = false; store.reportError(cause, 'Não foi possível ouvir o atalho.') }
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
    recurringWatcher ??= window.setInterval(() => void store.processScheduledAutomation().catch((cause) => store.reportError(cause, 'Não foi possível atualizar as automações mensais.')), 60 * 60 * 1000)
  } catch (cause) { bootError.value = cause instanceof Error ? cause.message : 'Não foi possível abrir seus dados.' }
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
watch([() => store.preferences.shakeToExpenseEnabled, () => store.preferences.shakeSensitivity, activeView, showQuickExpense, showTransactionComposer], ([enabled, sensitivity, view, quickOpen, composerOpen]) => {
  stopShakeListener?.(); stopShakeListener = undefined
  if (enabled && view === 'home' && !quickOpen && !composerOpen) stopShakeListener = startShakeListener(() => openQuickExpense(), sensitivity)
}, { immediate: true })

onMounted(async () => {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent) => { systemDark.value = event.matches }
  query.addEventListener('change', listener)
  removeSystemThemeListener = () => query.removeEventListener('change', listener)
  stopWebApp = await setupWebApp()
  await initializeApp()
})
onBeforeUnmount(() => {
  removeDeepLinkListener?.(); stopReminderWatcher?.(); stopWebApp?.(); removeSystemThemeListener?.()
  if (recurringWatcher) window.clearInterval(recurringWatcher)
  if (pingoMessageTimer !== undefined) window.clearTimeout(pingoMessageTimer)
  if (voiceTimer !== undefined) window.clearTimeout(voiceTimer)
  stopShakeListener?.(); stopVoiceListener?.()
})
</script>

<template>
  <div class="min-h-dvh overflow-x-clip bg-canvas pb-28 text-ink lg:pb-0" :class="store.preferences.economyMode ? 'pingo-economy' : ''">
    <a href="#main-content" class="fixed left-3 top-3 z-[150] -translate-y-24 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-surface transition focus:translate-y-0">Pular para o conteúdo</a>
    <div v-if="!isOnline" class="safe-top sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-300 px-4 py-2 text-center text-xs font-bold text-amber-950" role="status"><WifiOff :size="15" /> Sem internet — seus dados locais continuam disponíveis.</div>

    <DesktopSidebar v-if="store.initialized" :active-view="activeView" :display-name="displayName" @navigate="navigate" @add="openComposer" />

    <div v-if="store.initialized" class="fixed right-6 top-5 z-30 hidden items-center gap-2 lg:flex">
      <button v-if="canInstallWebApp" class="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3 text-xs font-bold" @click="installApp"><Download :size="16" /> Instalar</button>
      <button v-if="store.preferences.voiceShortcutsEnabled" class="grid size-11 place-items-center rounded-2xl border border-line bg-surface" :class="voiceListening ? 'text-brand ring-2 ring-brand' : 'text-subtle'" :aria-label="voiceListening ? 'Ouvindo atalho de voz' : 'Usar atalho de voz'" @click="listenVoice"><Mic :size="18" /></button>
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
      class="min-w-0 lg:ml-[248px]"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <AccountsView v-if="activeView === 'accounts'" :focus-card-id="walletFocusCardId" :initial-section="accountsSection" @quick-expense="openQuickExpense" />
      <DashboardView v-else-if="activeView === 'home'" @new-transaction="openComposer" @navigate="navigate" />
      <ExpensesSavingsView v-else-if="activeView === 'analytics'" />
      <AppSettings v-else embedded />
    </div>

    <MobileBottomNav v-if="store.initialized" :active-view="activeView" @navigate="navigate" />
    <AddTransactionModal v-if="showTransactionComposer && store.initialized" :categories="store.categories" :cards="store.debitCards" :vaults="store.vaults" @close="showTransactionComposer = false" @save="saveTransaction" @save-recurring="saveRecurring" @send-to-vault="sendToVault" />
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
