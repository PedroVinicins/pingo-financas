<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bell, LayoutDashboard, Moon, PiggyBank, Sparkles, Sun, WalletCards, X, Zap } from 'lucide-vue-next'
import DashboardView from './views/DashboardView.vue'
import WalletView from './views/WalletView.vue'
import VaultsView from './views/VaultsView.vue'
import QuickExpenseSheet from './components/QuickExpenseSheet.vue'
import NotificationSettings from './components/NotificationSettings.vue'
import { useFinanceStore } from './stores/financeStore'
import { defaultCategories } from './data/defaultCategories'
import { listenForQuickLaunch } from './services/quickLaunch'
import { startWebReminderWatcher } from './services/notifications'
import type { NewTransactionInput, QuickLaunchAction } from './types/finance'

const store = useFinanceStore()
const dark = ref(localStorage.getItem('theme') === 'dark')
const activeView = ref<'dashboard' | 'wallet' | 'vaults'>('dashboard')
const showQuickExpense = ref(false)
const showNotificationSettings = ref(false)
const quickCardId = ref<string | undefined>()
const walletFocusCardId = ref<string | undefined>()
let removeDeepLinkListener: (() => void) | undefined
let stopReminderWatcher: (() => void) | undefined
let recurringWatcher: number | undefined

const pageTitle = computed(() => ({ dashboard: 'Meu dinheiro', wallet: 'Carteira', vaults: 'Cofres' })[activeView.value])
function applyTheme() { document.documentElement.classList.toggle('dark', dark.value); localStorage.setItem('theme', dark.value ? 'dark' : 'light') }
function toggleTheme() { dark.value = !dark.value; applyTheme() }
function openQuickExpense(cardId?: string) { quickCardId.value = cardId; showQuickExpense.value = true }
function handleLaunch(action: QuickLaunchAction) {
  if (action.type === 'expense') openQuickExpense(action.cardId)
  if (action.type === 'wallet') { activeView.value = 'wallet'; walletFocusCardId.value = action.cardId }
  if (action.type === 'vaults') activeView.value = 'vaults'
  if (action.type === 'dashboard') activeView.value = 'dashboard'
}
async function saveQuickExpense(input: NewTransactionInput) {
  try {
    await store.createTransaction(input)
    showQuickExpense.value = false
    quickCardId.value = undefined
  } catch (cause) {
    window.alert(cause instanceof Error ? cause.message : 'Não foi possível registrar o gasto.')
  }
}

onMounted(async () => {
  applyTheme()
  await store.initialize(defaultCategories)
  removeDeepLinkListener = await listenForQuickLaunch(handleLaunch)
  stopReminderWatcher = startWebReminderWatcher()
  recurringWatcher = window.setInterval(() => void store.processRecurringRules(), 60 * 60 * 1000)
})
onBeforeUnmount(() => {
  removeDeepLinkListener?.()
  stopReminderWatcher?.()
  if (recurringWatcher) window.clearInterval(recurringWatcher)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-28 transition-colors dark:bg-slate-950 sm:pb-0">
    <header class="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div class="flex min-w-0 items-center gap-3">
          <div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-400 text-lg font-black text-slate-950">P</div>
          <div class="min-w-0"><div class="flex items-center gap-2"><p class="text-sm font-black tracking-tight">Pingo</p><span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">v0.5.0</span></div><h1 class="truncate text-xs font-semibold text-slate-500 sm:text-sm">{{ pageTitle }}</h1></div>
        </div>

        <nav class="hidden items-center rounded-2xl bg-slate-100 p-1 dark:bg-slate-900 sm:flex">
          <button class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold" :class="activeView === 'dashboard' ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-500'" @click="activeView = 'dashboard'"><LayoutDashboard :size="17" /> Resumo</button>
          <button class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold" :class="activeView === 'wallet' ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-500'" @click="walletFocusCardId = undefined; activeView = 'wallet'"><WalletCards :size="17" /> Carteira</button>
          <button class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold" :class="activeView === 'vaults' ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-500'" @click="activeView = 'vaults'"><PiggyBank :size="17" /> Cofres</button>
        </nav>

        <div class="flex items-center gap-2"><button class="hidden items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-slate-950 sm:flex" @click="openQuickExpense()"><Zap :size="17" fill="currentColor" /> Gasto rápido</button><button class="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Configurar alertas" @click="showNotificationSettings = true"><Bell :size="18" /></button><button class="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Alternar tema" @click="toggleTheme"><Sun v-if="dark" :size="18" /><Moon v-else :size="18" /></button></div>
      </div>
    </header>

    <DashboardView v-if="activeView === 'dashboard'" />
    <WalletView v-else-if="activeView === 'wallet'" :focus-card-id="walletFocusCardId" @quick-expense="openQuickExpense" />
    <VaultsView v-else />

    <nav class="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-[1fr_1fr_84px_1fr] items-end rounded-[1.6rem] border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:hidden">
      <button class="grid place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'dashboard' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" @click="activeView = 'dashboard'"><LayoutDashboard :size="20" /> Resumo</button>
      <button class="grid place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'wallet' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" @click="walletFocusCardId = undefined; activeView = 'wallet'"><WalletCards :size="20" /> Carteira</button>
      <button class="relative -top-6 mx-auto grid size-[4.5rem] place-items-center rounded-[1.55rem] bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/30 active:scale-95" aria-label="Registrar gasto rápido" @click="openQuickExpense()"><Zap :size="31" fill="currentColor" stroke-width="2.5" /><span class="absolute -bottom-[1.15rem] whitespace-nowrap text-[10px] font-black text-slate-700 dark:text-slate-300">Gasto rápido</span></button>
      <button class="grid place-items-center gap-1 rounded-2xl py-2 text-[11px] font-black" :class="activeView === 'vaults' ? 'text-slate-950 dark:text-white' : 'text-slate-400'" @click="activeView = 'vaults'"><PiggyBank :size="20" /> Cofres</button>
    </nav>

    <QuickExpenseSheet v-if="showQuickExpense" :key="quickCardId ?? 'generic'" :categories="store.categories" :cards="store.debitCards" :recent-category-ids="store.recentExpenseCategoryIds" :initial-card-id="quickCardId" @close="showQuickExpense = false" @save="saveQuickExpense" />
    <NotificationSettings v-if="showNotificationSettings" @close="showNotificationSettings = false" />

    <transition enter-active-class="transition duration-300" enter-from-class="translate-y-5 opacity-0" leave-active-class="transition duration-200" leave-to-class="translate-y-5 opacity-0">
      <aside v-if="store.pingoMessage" class="fixed bottom-28 left-4 right-4 z-[90] mx-auto flex max-w-md items-start gap-3 rounded-[1.4rem] border border-emerald-300/50 bg-slate-950 p-4 text-white shadow-2xl sm:bottom-6">
        <div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-300 font-black text-emerald-950">P</div><div class="min-w-0 flex-1"><p class="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-300"><Sparkles :size="13" /> Pingo diz</p><p class="mt-1 text-sm font-semibold leading-relaxed">{{ store.pingoMessage }}</p></div><button class="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10" aria-label="Fechar mensagem" @click="store.dismissPingoMessage"><X :size="16" /></button>
      </aside>
    </transition>
  </div>
</template>
