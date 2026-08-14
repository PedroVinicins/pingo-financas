<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Bell, ChartPie, Download, LayoutDashboard, Moon, PiggyBank, RefreshCw, Settings,
  Sparkles, Sun, WalletCards, WifiOff, X, Zap,
} from 'lucide-vue-next'
import DashboardView from './views/DashboardView.vue'
import ExpensesSavingsView from './views/ExpensesSavingsView.vue'
import WalletView from './views/WalletView.vue'
import VaultsView from './views/VaultsView.vue'
import AppFeedback from './components/AppFeedback.vue'
import NotificationSettings from './components/NotificationSettings.vue'
import QuickExpenseSheet from './components/QuickExpenseSheet.vue'
import AppSettings from './components/AppSettings.vue'
import { useFinanceStore } from './stores/financeStore'
import { defaultCategories } from './data/defaultCategories'
import { listenForQuickLaunch } from './services/quickLaunch'
import { startWebReminderWatcher } from './services/notifications'
import {
  applyWebUpdate, canInstallWebApp, hasWebUpdate, installWebApp, isOnline, setupWebApp,
} from './services/pwa'
import type { NewTransactionInput, QuickLaunchAction } from './types/finance'

type ViewName = 'dashboard' | 'expenses' | 'wallet' | 'vaults'

const store = useFinanceStore()
const storedTheme = (() => { try { return localStorage.getItem('theme') } catch { return null } })()
const dark = ref(storedTheme ? storedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)
const storedView = (() => { try { return sessionStorage.getItem('pingo:active-view') } catch { return null } })()
const activeView = ref<ViewName>(['dashboard', 'expenses', 'wallet', 'vaults'].includes(storedView ?? '')
  ? storedView as ViewName
  : 'dashboard')
const showQuickExpense = ref(false)
const showNotificationSettings = ref(false)
const showAppSettings = ref(false)
const quickCardId = ref<string | undefined>()
const walletFocusCardId = ref<string | undefined>()
const bootError = ref('')
const navigationItems = [
  { id: 'dashboard' as const, label: 'Resumo', icon: LayoutDashboard },
  { id: 'expenses' as const, label: 'Gastos', icon: ChartPie },
  { id: 'wallet' as const, label: 'Carteira', icon: WalletCards },
  { id: 'vaults' as const, label: 'Cofres', icon: PiggyBank },
]
let removeDeepLinkListener: (() => void) | undefined
let stopReminderWatcher: (() => void) | undefined
let stopWebApp: (() => void) | undefined
let recurringWatcher: number | undefined

const pageTitle = computed(() => ({
  dashboard: 'Meu dinheiro', expenses: 'Gastos e economias', wallet: 'Carteira', vaults: 'Cofres',
})[activeView.value])

function applyTheme() {
  document.documentElement.classList.toggle('dark', dark.value)
  document.documentElement.style.colorScheme = dark.value ? 'dark' : 'light'
  try { localStorage.setItem('theme', dark.value ? 'dark' : 'light') } catch { /* preferência não persistida */ }
}
function toggleTheme() { dark.value = !dark.value; applyTheme() }
function openQuickExpense(cardId?: string) { quickCardId.value = cardId; showQuickExpense.value = true }
function closeQuickExpense() { showQuickExpense.value = false; quickCardId.value = undefined }
function navigate(view: ViewName) {
  if (view !== 'wallet') walletFocusCardId.value = undefined
  activeView.value = view
}
function handleLaunch(action: QuickLaunchAction) {
  if (action.type === 'expense') openQuickExpense(action.cardId)
  if (action.type === 'wallet') { navigate('wallet'); walletFocusCardId.value = action.cardId }
  if (action.type === 'vaults') navigate('vaults')
  if (action.type === 'dashboard') navigate('dashboard')
}
async function saveQuickExpense(input: NewTransactionInput) {
  try {
    await store.createTransaction(input)
    closeQuickExpense()
  } catch (cause) { store.reportError(cause, 'Não foi possível registrar o gasto.') }
}
async function initializeApp() {
  bootError.value = ''
  try {
    await store.initialize(defaultCategories)
    removeDeepLinkListener ??= await listenForQuickLaunch(handleLaunch)
    stopReminderWatcher ??= startWebReminderWatcher()
    recurringWatcher ??= window.setInterval(() => {
      void store.processScheduledAutomation().catch((cause) =>
        store.reportError(cause, 'Não foi possível atualizar as automações mensais.'))
    }, 60 * 60 * 1000)
  } catch (cause) {
    bootError.value = cause instanceof Error ? cause.message : 'Não foi possível abrir seus dados.'
  }
}
async function installApp() {
  if (await installWebApp()) store.showFeedback('Pingo instalado neste dispositivo.', 'success')
}

watch(activeView, (view) => {
  try { sessionStorage.setItem('pingo:active-view', view) } catch { /* navegação continua em memória */ }
  document.title = `${pageTitle.value} · Pingo`
}, { immediate: true })

onMounted(async () => {
  applyTheme()
  stopWebApp = await setupWebApp()
  await initializeApp()
})
onBeforeUnmount(() => {
  removeDeepLinkListener?.()
  stopReminderWatcher?.()
  stopWebApp?.()
  if (recurringWatcher) window.clearInterval(recurringWatcher)
})
</script>

<template>
  <div class="min-h-dvh bg-slate-50 pb-28 transition-colors dark:bg-slate-950 sm:pb-0">
    <a href="#main-content" class="fixed left-3 top-3 z-[150] -translate-y-24 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition focus:translate-y-0 dark:bg-white dark:text-slate-950">Pular para o conteúdo</a>

    <div v-if="!isOnline" class="safe-top sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-300 px-4 py-2 text-center text-xs font-black text-amber-950" role="status"><WifiOff :size="15" /> Sem internet — seus dados locais continuam disponíveis.</div>

    <header v-if="store.initialized" class="safe-top sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <button class="flex min-w-0 items-center gap-3 text-left" aria-label="Ir para o resumo" @click="navigate('dashboard')">
          <img src="/pingo-icon.svg" alt="" class="size-10 shrink-0 rounded-2xl shadow-sm" />
          <span class="min-w-0"><span class="flex items-center gap-2"><span class="text-sm font-black tracking-tight">Pingo</span><span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">v0.8.0</span></span><span class="block truncate text-xs font-semibold text-slate-500 sm:text-sm">{{ pageTitle }}</span></span>
        </button>

        <nav class="hidden items-center rounded-2xl bg-slate-100 p-1 dark:bg-slate-900 md:flex" aria-label="Navegação principal">
          <button v-for="item in navigationItems" :key="item.id" class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold" :class="activeView === item.id ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-500'" :aria-current="activeView === item.id ? 'page' : undefined" @click="navigate(item.id)"><component :is="item.icon" :size="17" /> {{ item.label }}</button>
        </nav>

        <div class="flex items-center gap-2">
          <button v-if="canInstallWebApp" class="hidden items-center gap-2 rounded-2xl border border-emerald-300 px-3 py-2.5 text-sm font-black text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 lg:flex" @click="installApp"><Download :size="17" /> Instalar</button>
          <button class="hidden items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-slate-950 sm:flex" @click="openQuickExpense()"><Zap :size="17" fill="currentColor" /> Gasto rápido</button>
          <button class="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Configurar alertas" @click="showNotificationSettings = true"><Bell :size="18" /></button>
          <button class="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Dados e configurações" @click="showAppSettings = true"><Settings :size="18" /></button>
          <button class="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" :aria-label="dark ? 'Usar tema claro' : 'Usar tema escuro'" @click="toggleTheme"><Sun v-if="dark" :size="18" /><Moon v-else :size="18" /></button>
        </div>
      </div>
      <div v-if="hasWebUpdate" class="border-t border-sky-200 bg-sky-50 px-4 py-2 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"><div class="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs font-bold"><span>Uma atualização do Pingo está pronta.</span><button class="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 font-black text-white" @click="applyWebUpdate"><RefreshCw :size="13" /> Atualizar agora</button></div></div>
    </header>

    <main v-if="store.isInitializing" id="main-content" class="grid min-h-[75dvh] place-items-center px-6 text-center">
      <div><div class="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-emerald-300 text-2xl font-black text-emerald-950 shadow-xl">P</div><RefreshCw class="mx-auto mt-6 animate-spin text-emerald-600" :size="24" /><h1 class="mt-3 text-xl font-black">Abrindo seu Pingo</h1><p class="mt-1 text-sm text-slate-500">Conferindo saldos, cofres e compromissos…</p></div>
    </main>

    <main v-else-if="bootError" id="main-content" class="grid min-h-[75dvh] place-items-center px-6 py-12 text-center">
      <div class="max-w-md rounded-[2rem] border border-rose-200 bg-white p-7 shadow-xl dark:border-rose-900 dark:bg-slate-900"><div class="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-100 text-2xl dark:bg-rose-950">😵‍💫</div><h1 class="mt-5 text-2xl font-black">O Pingo não conseguiu abrir os dados</h1><p class="mt-2 text-sm leading-relaxed text-slate-500">{{ bootError }}</p><button class="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white dark:bg-white dark:text-slate-950" @click="initializeApp"><RefreshCw :size="17" /> Tentar novamente</button><p class="mt-4 text-xs text-slate-400">Nenhum dado foi apagado.</p></div>
    </main>

    <div v-else-if="store.initialized" id="main-content">
      <DashboardView v-if="activeView === 'dashboard'" />
      <ExpensesSavingsView v-else-if="activeView === 'expenses'" />
      <WalletView v-else-if="activeView === 'wallet'" :focus-card-id="walletFocusCardId" @quick-expense="openQuickExpense" />
      <VaultsView v-else />
    </div>

    <nav v-if="store.initialized" class="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-[1fr_1fr_84px_1fr_1fr] items-end rounded-[1.6rem] border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 md:hidden" aria-label="Navegação principal">
      <button class="grid min-h-12 place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'dashboard' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" :aria-current="activeView === 'dashboard' ? 'page' : undefined" @click="navigate('dashboard')"><LayoutDashboard :size="20" /> Resumo</button>
      <button class="grid min-h-12 place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'expenses' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" :aria-current="activeView === 'expenses' ? 'page' : undefined" @click="navigate('expenses')"><ChartPie :size="20" /> Gastos</button>
      <button class="relative -top-6 mx-auto grid size-[4.5rem] place-items-center rounded-[1.55rem] bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/30 active:scale-95" aria-label="Registrar gasto rápido" @click="openQuickExpense()"><Zap :size="31" fill="currentColor" stroke-width="2.5" /><span class="absolute -bottom-[1.15rem] whitespace-nowrap text-[10px] font-black text-slate-700 dark:text-slate-300">Gasto rápido</span></button>
      <button class="grid min-h-12 place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'wallet' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" :aria-current="activeView === 'wallet' ? 'page' : undefined" @click="navigate('wallet')"><WalletCards :size="20" /> Carteira</button>
      <button class="grid min-h-12 place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'vaults' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" :aria-current="activeView === 'vaults' ? 'page' : undefined" @click="navigate('vaults')"><PiggyBank :size="20" /> Cofres</button>
    </nav>

    <QuickExpenseSheet v-if="showQuickExpense && store.initialized" :key="quickCardId ?? 'generic'" :categories="store.categories" :cards="store.debitCards" :recent-category-ids="store.recentExpenseCategoryIds" :initial-card-id="quickCardId" @close="closeQuickExpense" @save="saveQuickExpense" />
    <NotificationSettings v-if="showNotificationSettings" @close="showNotificationSettings = false" />
    <AppSettings v-if="showAppSettings" @close="showAppSettings = false" />

    <Transition enter-active-class="transition duration-300" enter-from-class="translate-y-5 opacity-0" leave-active-class="transition duration-200" leave-to-class="translate-y-5 opacity-0">
      <aside v-if="store.pingoMessage" class="fixed bottom-28 left-4 right-4 z-[90] mx-auto flex max-w-md items-start gap-3 rounded-[1.4rem] border border-emerald-300/50 bg-slate-950 p-4 text-white shadow-2xl sm:bottom-6" role="status"><div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-300 font-black text-emerald-950">P</div><div class="min-w-0 flex-1"><p class="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-300"><Sparkles :size="13" /> Pingo diz</p><p class="mt-1 text-sm font-semibold leading-relaxed">{{ store.pingoMessage }}</p></div><button class="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10" aria-label="Fechar mensagem" @click="store.dismissPingoMessage"><X :size="16" /></button></aside>
    </Transition>
    <AppFeedback />
  </div>
</template>
