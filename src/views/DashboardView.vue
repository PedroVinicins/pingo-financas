<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarClock, Eye, EyeOff, Gauge, Landmark, LayoutGrid, Pencil, PiggyBank, Plus,
  ShieldCheck, Sparkles, TrendingDown, WalletCards,
} from 'lucide-vue-next'
import { useFinanceStore, centsToDecimal } from '../stores/financeStore'
import type { DashboardLayout, NewRecurringRuleInput, NewTransactionInput, Transaction } from '../types/finance'
import TransactionList from '../components/TransactionList.vue'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import EditBalanceModal from '../components/EditBalanceModal.vue'
import RecurringSection from '../components/RecurringSection.vue'
import TransactionFiltersBar from '../components/TransactionFiltersBar.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import DashboardCustomizer from '../components/DashboardCustomizer.vue'

const store = useFinanceStore()
const showModal = ref(false)
const showBalanceEditor = ref(false)
const showCustomizer = ref(false)
const editingTransaction = ref<Transaction | null>(null)
const showAllHistory = ref(false)
const deletingTransaction = ref<Transaction | null>(null)
const deleting = ref(false)

function money(value: bigint) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value))) }
function privateMoney(value: bigint) { return store.balanceHidden ? 'R$ •••••' : money(value) }
function widgetClass(size: string) {
  return size === 'small' ? 'lg:col-span-3' : size === 'medium' ? 'lg:col-span-6' : 'lg:col-span-12'
}
const visibleWidgets = computed(() => store.dashboardLayout.widgets.filter((item) => item.visible))
const scoreLabel = computed(() => store.financialHealthScore >= 80 ? 'Excelente' : store.financialHealthScore >= 60 ? 'Boa' : store.financialHealthScore >= 40 ? 'Em atenção' : 'Precisa de cuidado')
const categoryRows = computed(() => [...store.currentMonthExpensesByCategory.entries()]
  .sort((a, b) => Number(b[1] - a[1])).slice(0, 5).map(([id, amount]) => ({
    id, amount, category: store.categories.find((item) => item.id === id),
    percentage: store.currentMonthExpensePercentages.get(id) ?? 0,
  })))
const historyTransactions = computed(() => showAllHistory.value ? store.filteredTransactions : store.recentTransactions)

async function save(input: NewTransactionInput) {
  try {
    if (editingTransaction.value) await store.editTransaction({ id: editingTransaction.value.id, ...input })
    else await store.createTransaction(input)
    showModal.value = false; editingTransaction.value = null
  } catch (cause) { store.reportError(cause, 'Não foi possível salvar.') }
}
async function saveRecurring(input: NewRecurringRuleInput) {
  try { await store.createRecurringRule(input); showModal.value = false }
  catch (cause) { store.reportError(cause, 'Não foi possível ligar o Piloto Mensal.') }
}
function edit(transaction: Transaction) { editingTransaction.value = transaction; showModal.value = true }
async function confirmDelete() {
  if (!deletingTransaction.value) return
  deleting.value = true
  try { await store.deleteTransaction(deletingTransaction.value.id); deletingTransaction.value = null; store.showFeedback('Transação excluída e saldos recalculados.', 'success') }
  catch (cause) { store.reportError(cause, 'Não foi possível excluir a transação.') }
  finally { deleting.value = false }
}
async function editBalance(amount: string) {
  try { await store.setAvailableBalance(amount); showBalanceEditor.value = false }
  catch (cause) { store.reportError(cause, 'Não foi possível ajustar o saldo.') }
}
async function saveLayout(layout: DashboardLayout) {
  try { await store.saveDashboard(layout); showCustomizer.value = false; store.showFeedback('Tela principal personalizada.', 'success') }
  catch (cause) { store.reportError(cause, 'Não foi possível salvar o painel.') }
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-bold text-emerald-600">Meu resumo</p><h1 class="text-2xl font-black">O que importa para você</h1></div><div class="flex gap-2"><button class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black dark:border-slate-800 dark:bg-slate-900" @click="showCustomizer = true"><LayoutGrid :size="17" /> Personalizar</button><button class="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-emerald-950" @click="showModal = true"><Plus :size="18" /> <span class="hidden sm:inline">Transação</span></button></div></div>

    <section v-if="visibleWidgets.length" class="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <template v-for="widget in visibleWidgets" :key="widget.id">
        <article v-if="widget.id === 'net_worth'" class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-700 p-6 text-white shadow-2xl sm:p-8" :class="widgetClass(widget.size)"><div class="absolute -right-14 -top-16 size-52 rounded-full bg-emerald-300/15 blur-2xl"></div><div class="relative flex items-start justify-between"><div class="grid size-12 place-items-center rounded-[1.1rem] bg-emerald-300 text-xl font-black text-emerald-950">P</div><button class="grid size-11 place-items-center rounded-2xl bg-white/10" :aria-label="store.balanceHidden ? 'Mostrar saldos' : 'Esconder saldos'" @click="store.toggleBalanceVisibility"><Eye v-if="store.balanceHidden" :size="20" /><EyeOff v-else :size="20" /></button></div><p class="relative mt-7 text-sm font-bold text-emerald-200">Patrimônio total</p><h2 class="relative mt-1 text-4xl font-black tracking-tight sm:text-5xl">{{ privateMoney(store.balanceCents) }}</h2><p class="relative mt-2 text-sm text-emerald-100/75">Conta principal + todos os porquinhos.</p><button class="relative mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black" @click="showBalanceEditor = true"><Pencil :size="16" /> Editar saldo</button></article>

        <article v-else-if="widget.id === 'available_balance'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900" :class="widgetClass(widget.size)"><div class="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950"><WalletCards :size="19" /></div><p class="mt-4 text-xs font-bold text-slate-400">Saldo da carteira</p><p class="mt-1 text-2xl font-black">{{ privateMoney(store.availableBalanceCents) }}</p><p class="mt-1 text-xs text-slate-500">Disponível agora</p></article>
        <article v-else-if="widget.id === 'vault_total'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900" :class="widgetClass(widget.size)"><div class="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950"><PiggyBank :size="19" /></div><p class="mt-4 text-xs font-bold text-slate-400">Nos porquinhos</p><p class="mt-1 text-2xl font-black">{{ privateMoney(store.vaultTotalCents) }}</p><p class="mt-1 text-xs text-slate-500">Reserva protegida</p></article>
        <article v-else-if="widget.id === 'month_expenses'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900" :class="widgetClass(widget.size)"><div class="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950"><TrendingDown :size="19" /></div><p class="mt-4 text-xs font-bold text-slate-400">Gastos do mês</p><p class="mt-1 text-2xl font-black">{{ privateMoney(store.currentMonthExpenseCents) }}</p><p class="mt-1 text-xs text-slate-500">Até hoje</p></article>
        <article v-else-if="widget.id === 'daily_budget'" class="rounded-[1.75rem] bg-gradient-to-br from-emerald-300 to-lime-300 p-5 text-emerald-950 shadow-card" :class="widgetClass(widget.size)"><CalendarClock :size="22" /><p class="mt-4 text-xs font-black uppercase tracking-wider opacity-70">Posso gastar hoje</p><p class="mt-1 text-2xl font-black">{{ privateMoney(store.dailyBudgetCents) }}</p><p class="mt-1 text-xs font-bold opacity-70">Sem tocar nos porquinhos</p></article>
        <article v-else-if="widget.id === 'month_balance'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900" :class="widgetClass(widget.size)"><Landmark :size="21" class="text-emerald-600" /><p class="mt-4 text-xs font-bold text-slate-400">Resultado do mês</p><p class="mt-1 text-3xl font-black" :class="store.currentMonthBalanceCents >= 0n ? 'text-emerald-600' : 'text-rose-600'">{{ privateMoney(store.currentMonthBalanceCents) }}</p><p class="mt-1 text-xs text-slate-500">Entradas menos gastos</p></article>

        <div v-else-if="widget.id === 'recurring'" :class="widgetClass(widget.size)"><RecurringSection /></div>
        <section v-else-if="widget.id === 'insights'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6" :class="widgetClass(widget.size)"><div class="flex items-start justify-between"><div><p class="text-sm font-bold text-emerald-600">Leituras do Pingo</p><h3 class="text-xl font-black">Para onde vai o dinheiro?</h3></div><Gauge :size="24" /></div><div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><ShieldCheck :size="16" class="text-slate-400" /><p class="mt-2 text-2xl font-black">{{ store.financialHealthScore }}<span class="text-sm text-slate-400">/100</span></p><p class="text-xs font-bold text-emerald-600">{{ scoreLabel }}</p></div><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><Sparkles :size="16" class="text-slate-400" /><p class="mt-2 text-xl font-black">{{ privateMoney(store.fixedMonthlyCommitmentCents) }}</p><p class="text-xs text-slate-500">Fixos previstos</p></div><div class="col-span-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><TrendingDown :size="16" class="text-slate-400" /><p class="mt-2 truncate text-lg font-black">{{ store.topExpenseCategory.category?.name ?? 'Sem gastos' }}</p><p class="text-xs text-slate-500">{{ store.topExpenseCategory.percentage.toFixed(1) }}% das despesas</p></div></div><div v-if="categoryRows.length" class="mt-5 grid gap-3"><div v-for="row in categoryRows" :key="row.id"><div class="mb-1 flex justify-between gap-2 text-sm"><strong class="truncate">{{ row.category?.name ?? 'Sem categoria' }}</strong><strong>{{ privateMoney(row.amount) }}</strong></div><div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full" :style="{ width: `${row.percentage}%`, backgroundColor: row.category?.color ?? '#10B981' }"></div></div></div></div></section>
        <section v-else-if="widget.id === 'history'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6" :class="widgetClass(widget.size)"><div class="mb-2 flex items-center justify-between gap-3"><div><p class="text-sm text-slate-500">Histórico editável</p><h3 class="text-xl font-black">Movimentações</h3></div><button v-if="!store.hasActiveFilters" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black dark:border-slate-700" @click="showAllHistory = !showAllHistory">{{ showAllHistory ? 'Recentes' : 'Ver tudo' }}</button></div><TransactionFiltersBar /><TransactionList class="mt-2" :transactions="store.hasActiveFilters ? store.filteredTransactions : historyTransactions" :categories="store.categories" :cards="store.debitCards" editable @edit="edit" /></section>
      </template>
    </section>
    <section v-else class="grid min-h-72 place-items-center rounded-[2rem] border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700"><div><LayoutGrid :size="38" class="mx-auto text-emerald-500" /><h2 class="mt-4 text-xl font-black">Seu painel está vazio</h2><p class="mt-1 text-sm text-slate-500">Escolha pelo menos um cartão para acompanhar.</p><button class="mt-4 rounded-2xl bg-emerald-400 px-5 py-3 font-black text-emerald-950" @click="showCustomizer = true">Personalizar painel</button></div></section>
  </main>

  <DashboardCustomizer v-if="showCustomizer" :layout="store.dashboardLayout" @close="showCustomizer = false" @save="saveLayout" />
  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" @delete="deletingTransaction = $event" />
  <EditBalanceModal v-if="showBalanceEditor" :current-balance="centsToDecimal(store.availableBalanceCents)" @close="showBalanceEditor = false" @save="editBalance" />
  <ConfirmDialog v-if="deletingTransaction" title="Excluir transação?" :message="`“${deletingTransaction.description}” será removida e os saldos serão recalculados.`" confirm-label="Excluir transação" :busy="deleting" @cancel="deletingTransaction = null" @confirm="confirmDelete" />
</template>
