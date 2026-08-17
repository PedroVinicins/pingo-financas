<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  CalendarClock, Eye, EyeOff, FileUp, Gauge, GripVertical, Landmark, LayoutGrid, Maximize2,
  Pencil, PiggyBank, Plus, ShieldCheck, Sparkles, TrendingDown, WalletCards, X,
} from 'lucide-vue-next'
import { useFinanceStore, centsToDecimal } from '../stores/financeStore'
import type { BankStatementImportInput, DashboardWidgetId, DashboardWidgetSize, NewRecurringRuleInput, NewTransactionInput, Transaction } from '../types/finance'
import { cloneDashboardLayout, DASHBOARD_WIDGETS } from '../services/dashboardLayout'
import TransactionList from '../components/TransactionList.vue'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import EditBalanceModal from '../components/EditBalanceModal.vue'
import RecurringSection from '../components/RecurringSection.vue'
import TransactionFiltersBar from '../components/TransactionFiltersBar.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import BankStatementImport from '../components/BankStatementImport.vue'

const store = useFinanceStore()
const showModal = ref(false)
const showBalanceEditor = ref(false)
const showStatementImport = ref(false)
const importingStatement = ref(false)
const customizing = ref(false)
const draggingWidget = ref<DashboardWidgetId | null>(null)
const touchDropTarget = ref<DashboardWidgetId | null>(null)
const editingTransaction = ref<Transaction | null>(null)
const showAllHistory = ref(false)
const deletingTransaction = ref<Transaction | null>(null)
const deleting = ref(false)

function money(value: bigint) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value))) }
function privateMoney(value: bigint) { return store.balanceHidden ? 'R$ •••••' : money(value) }
function widgetClass(size: string) {
  return size === 'small'
    ? 'col-span-1 lg:col-span-3'
    : size === 'medium' ? 'col-span-2 lg:col-span-6' : 'col-span-2 lg:col-span-12'
}
const visibleWidgets = computed(() => store.dashboardLayout.widgets.filter((item) => item.visible))
const hiddenWidgets = computed(() => store.dashboardLayout.widgets.filter((item) => !item.visible))
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
async function importStatement(input: BankStatementImportInput) {
  importingStatement.value = true
  try {
    const count = await store.importBankStatement(input)
    showStatementImport.value = false
    store.showFeedback(`${count} lançamento${count === 1 ? '' : 's'} importado${count === 1 ? '' : 's'} e saldo conferido.`, 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível importar o extrato.') }
  finally { importingStatement.value = false }
}
function persistLayout(change: (layout: ReturnType<typeof cloneDashboardLayout>) => void) {
  const next = cloneDashboardLayout(store.dashboardLayout)
  change(next)
  void store.saveDashboard(next).catch((cause) => store.reportError(cause, 'Não foi possível salvar o painel.'))
}
function moveWidget(from: DashboardWidgetId, to: DashboardWidgetId) {
  if (from === to) return
  persistLayout((layout) => {
    const fromIndex = layout.widgets.findIndex((item) => item.id === from)
    const toIndex = layout.widgets.findIndex((item) => item.id === to)
    if (fromIndex < 0 || toIndex < 0) return
    const [item] = layout.widgets.splice(fromIndex, 1)
    layout.widgets.splice(toIndex, 0, item)
  })
}
function cycleSize(id: DashboardWidgetId) {
  const sizes: DashboardWidgetSize[] = ['small', 'medium', 'large']
  persistLayout((layout) => {
    const widget = layout.widgets.find((item) => item.id === id)
    if (widget) widget.size = sizes[(sizes.indexOf(widget.size) + 1) % sizes.length]
  })
}
function setVisibility(id: DashboardWidgetId, visible: boolean) {
  persistLayout((layout) => {
    const widget = layout.widgets.find((item) => item.id === id)
    if (widget) widget.visible = visible
  })
}
function dragStart(id: DashboardWidgetId, event: DragEvent) {
  draggingWidget.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function dropWidget(id: DashboardWidgetId, event: DragEvent) {
  const from = event.dataTransfer?.getData('text/plain') as DashboardWidgetId
  if (from) moveWidget(from, id)
  draggingWidget.value = null
}
function pointerStart(id: DashboardWidgetId, event: PointerEvent) {
  if (event.pointerType === 'mouse') return
  draggingWidget.value = id
  touchDropTarget.value = id
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', pointerMove, { passive: false })
  window.addEventListener('pointerup', pointerEnd, { once: true })
}
function pointerMove(event: PointerEvent) {
  if (!draggingWidget.value) return
  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-dashboard-widget]')
  const id = target?.dataset.dashboardWidget as DashboardWidgetId | undefined
  if (id && id !== touchDropTarget.value) {
    touchDropTarget.value = id
    if (id !== draggingWidget.value) moveWidget(draggingWidget.value, id)
  }
}
function pointerEnd() {
  draggingWidget.value = null
  touchDropTarget.value = null
  window.removeEventListener('pointermove', pointerMove)
}
onBeforeUnmount(() => window.removeEventListener('pointermove', pointerMove))
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-bold text-emerald-600">Meu resumo</p><h1 class="text-2xl font-black">O que importa para você</h1><p v-if="customizing" class="mt-1 text-xs font-bold text-emerald-600">Arraste, redimensione ou esconda. Tudo é salvo automaticamente.</p></div><div class="flex flex-wrap gap-2"><button v-if="!customizing" class="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-white px-3 py-3 text-sm font-black text-sky-700 dark:border-sky-900 dark:bg-slate-900" @click="showStatementImport = true"><FileUp :size="17" /> Extrato</button><button class="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" :class="customizing ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'" @click="customizing = !customizing"><X v-if="customizing" :size="17" /><LayoutGrid v-else :size="17" /> {{ customizing ? 'Concluir' : 'Personalizar' }}</button><button v-if="!customizing" class="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-emerald-950" @click="showModal = true"><Plus :size="18" /> <span class="hidden sm:inline">Transação</span></button></div></div>

    <section v-if="customizing && hiddenWidgets.length" class="mb-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p class="text-xs font-black uppercase tracking-wider text-slate-400">Ocultos</p><div class="mt-2 flex flex-wrap gap-2"><button v-for="widget in hiddenWidgets" :key="widget.id" class="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black dark:bg-slate-800" @click="setVisibility(widget.id, true)"><Plus :size="14" /> {{ DASHBOARD_WIDGETS[widget.id].label }}</button></div></section>

    <TransitionGroup v-if="visibleWidgets.length" tag="section" class="grid grid-cols-2 gap-4 lg:grid-cols-12" move-class="transition-transform duration-300 ease-out">
      <div v-for="widget in visibleWidgets" :key="widget.id" :data-dashboard-widget="widget.id" class="relative min-w-0 transition-[transform,opacity] duration-200" :class="[widgetClass(widget.size), draggingWidget === widget.id ? 'z-10 scale-[1.02] rounded-[2rem] opacity-70 ring-2 ring-emerald-400 shadow-xl' : '', touchDropTarget === widget.id && draggingWidget !== widget.id ? 'scale-[.98]' : '']" @dragover.prevent @drop="dropWidget(widget.id, $event)">
        <div v-if="customizing" class="relative z-20 mb-2 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white p-2 shadow-sm dark:border-emerald-900 dark:bg-slate-900"><button draggable="true" class="grid size-10 touch-none place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950" :aria-label="`Arrastar ${DASHBOARD_WIDGETS[widget.id].label}`" @dragstart="dragStart(widget.id, $event)" @dragend="draggingWidget = null" @pointerdown="pointerStart(widget.id, $event)"><GripVertical :size="18" /></button><strong class="min-w-0 flex-1 truncate text-xs">{{ DASHBOARD_WIDGETS[widget.id].label }}</strong><button class="inline-flex h-10 items-center gap-1 rounded-xl bg-slate-100 px-2 text-[10px] font-black dark:bg-slate-800" :aria-label="`Mudar tamanho de ${DASHBOARD_WIDGETS[widget.id].label}`" @click="cycleSize(widget.id)"><Maximize2 :size="14" /> {{ widget.size === 'small' ? 'P' : widget.size === 'medium' ? 'M' : 'G' }}</button><button class="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950" :aria-label="`Ocultar ${DASHBOARD_WIDGETS[widget.id].label}`" @click="setVisibility(widget.id, false)"><EyeOff :size="16" /></button></div>
        <article v-if="widget.id === 'net_worth'" class="relative min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-700 p-5 text-white shadow-2xl sm:p-8"><div class="absolute -right-14 -top-16 size-52 rounded-full bg-emerald-300/15 blur-2xl"></div><div class="relative flex items-start justify-between gap-2"><div class="grid size-12 shrink-0 place-items-center rounded-[1.1rem] bg-emerald-300 text-xl font-black text-emerald-950">P</div><button class="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10" :aria-label="store.balanceHidden ? 'Mostrar saldos' : 'Esconder saldos'" @click="store.toggleBalanceVisibility"><Eye v-if="store.balanceHidden" :size="20" /><EyeOff v-else :size="20" /></button></div><p class="relative mt-7 truncate text-sm font-bold text-emerald-200">Patrimônio total</p><h2 class="relative mt-1 truncate text-3xl font-black tracking-tight tabular-nums sm:text-5xl" :title="privateMoney(store.balanceCents)">{{ privateMoney(store.balanceCents) }}</h2><p class="relative mt-2 truncate text-sm text-emerald-100/75">Conta principal + todos os porquinhos.</p><button class="relative mt-5 inline-flex max-w-full items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black" @click="showBalanceEditor = true"><Pencil class="shrink-0" :size="16" /><span class="truncate">Editar saldo</span></button></article>

        <article v-else-if="widget.id === 'available_balance'" class="relative min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-600 via-cyan-600 to-emerald-500 p-5 text-white shadow-xl sm:p-8"><div class="absolute -bottom-20 -right-16 size-56 rounded-full bg-white/15"></div><div class="relative grid size-12 place-items-center rounded-2xl bg-white/20"><WalletCards :size="22" /></div><p class="relative mt-6 truncate text-sm font-bold text-sky-100">Saldo da carteira</p><p class="relative mt-1 truncate text-3xl font-black tracking-tight tabular-nums sm:text-5xl" :title="privateMoney(store.availableBalanceCents)">{{ privateMoney(store.availableBalanceCents) }}</p><p class="relative mt-2 truncate text-sm font-semibold text-white/75">Dinheiro disponível agora, sem contar os porquinhos.</p><button class="relative mt-5 inline-flex max-w-full items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-sm font-black" @click="showBalanceEditor = true"><Pencil class="shrink-0" :size="16" /><span class="truncate">Corrigir saldo</span></button></article>
        <article v-else-if="widget.id === 'vault_total'" class="min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5"><div class="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950"><PiggyBank :size="19" /></div><p class="mt-4 truncate text-xs font-bold text-slate-400">Nos porquinhos</p><p class="mt-1 truncate text-xl font-black tabular-nums sm:text-2xl" :title="privateMoney(store.vaultTotalCents)">{{ privateMoney(store.vaultTotalCents) }}</p><p class="mt-1 truncate text-xs text-slate-500">Reserva protegida</p></article>
        <article v-else-if="widget.id === 'month_expenses'" class="min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5"><div class="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950"><TrendingDown :size="19" /></div><p class="mt-4 truncate text-xs font-bold text-slate-400">Gastos do mês</p><p class="mt-1 truncate text-xl font-black tabular-nums sm:text-2xl" :title="privateMoney(store.currentMonthExpenseCents)">{{ privateMoney(store.currentMonthExpenseCents) }}</p><p class="mt-1 truncate text-xs text-slate-500">Até hoje</p></article>
        <article v-else-if="widget.id === 'daily_budget'" class="min-w-0 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-300 to-lime-300 p-4 text-emerald-950 shadow-card sm:p-5"><CalendarClock :size="22" /><p class="mt-4 truncate text-xs font-black uppercase tracking-wider opacity-70">Posso gastar hoje</p><p class="mt-1 truncate text-xl font-black tabular-nums sm:text-2xl" :title="privateMoney(store.dailyBudgetCents)">{{ privateMoney(store.dailyBudgetCents) }}</p><p class="mt-1 truncate text-xs font-bold opacity-70">Sem tocar nos porquinhos</p></article>
        <article v-else-if="widget.id === 'month_balance'" class="min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5"><Landmark :size="21" class="text-emerald-600" /><p class="mt-4 truncate text-xs font-bold text-slate-400">Resultado do mês</p><p class="mt-1 truncate text-2xl font-black tabular-nums sm:text-3xl" :title="privateMoney(store.currentMonthBalanceCents)" :class="store.currentMonthBalanceCents >= 0n ? 'text-emerald-600' : 'text-rose-600'">{{ privateMoney(store.currentMonthBalanceCents) }}</p><p class="mt-1 truncate text-xs text-slate-500">Entradas menos gastos</p></article>

        <div v-else-if="widget.id === 'recurring'"><RecurringSection /></div>
        <section v-else-if="widget.id === 'insights'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div class="flex items-start justify-between"><div><p class="text-sm font-bold text-emerald-600">Leituras do Pingo</p><h3 class="text-xl font-black">Para onde vai o dinheiro?</h3></div><Gauge :size="24" /></div><div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><ShieldCheck :size="16" class="text-slate-400" /><p class="mt-2 text-2xl font-black">{{ store.financialHealthScore }}<span class="text-sm text-slate-400">/100</span></p><p class="text-xs font-bold text-emerald-600">{{ scoreLabel }}</p></div><div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><Sparkles :size="16" class="text-slate-400" /><p class="mt-2 text-xl font-black">{{ privateMoney(store.fixedMonthlyCommitmentCents) }}</p><p class="text-xs text-slate-500">Fixos previstos</p></div><div class="col-span-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><TrendingDown :size="16" class="text-slate-400" /><p class="mt-2 truncate text-lg font-black">{{ store.topExpenseCategory.category?.name ?? 'Sem gastos' }}</p><p class="text-xs text-slate-500">{{ store.topExpenseCategory.percentage.toFixed(1) }}% das despesas</p></div></div><div v-if="categoryRows.length" class="mt-5 grid gap-3"><div v-for="row in categoryRows" :key="row.id"><div class="mb-1 flex justify-between gap-2 text-sm"><strong class="truncate">{{ row.category?.name ?? 'Sem categoria' }}</strong><strong>{{ privateMoney(row.amount) }}</strong></div><div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full" :style="{ width: `${row.percentage}%`, backgroundColor: row.category?.color ?? '#10B981' }"></div></div></div></div></section>
        <section v-else-if="widget.id === 'history'" class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div class="mb-2 flex items-center justify-between gap-3"><div><p class="text-sm text-slate-500">Histórico editável</p><h3 class="text-xl font-black">Movimentações</h3></div><button v-if="!store.hasActiveFilters" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black dark:border-slate-700" @click="showAllHistory = !showAllHistory">{{ showAllHistory ? 'Recentes' : 'Ver tudo' }}</button></div><TransactionFiltersBar /><TransactionList class="mt-2" :transactions="store.hasActiveFilters ? store.filteredTransactions : historyTransactions" :categories="store.categories" :cards="store.debitCards" editable @edit="edit" /></section>
      </div>
    </TransitionGroup>
    <section v-else class="grid min-h-72 place-items-center rounded-[2rem] border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700"><div><LayoutGrid :size="38" class="mx-auto text-emerald-500" /><h2 class="mt-4 text-xl font-black">Seu painel está vazio</h2><p class="mt-1 text-sm text-slate-500">Ative a personalização para escolher o que deseja acompanhar.</p><button class="mt-4 rounded-2xl bg-emerald-400 px-5 py-3 font-black text-emerald-950" @click="customizing = true">Personalizar painel</button></div></section>
  </main>

  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" @delete="deletingTransaction = $event" />
  <EditBalanceModal v-if="showBalanceEditor" :current-balance="centsToDecimal(store.availableBalanceCents)" @close="showBalanceEditor = false" @save="editBalance" />
  <ConfirmDialog v-if="deletingTransaction" title="Excluir transação?" :message="`“${deletingTransaction.description}” será removida e os saldos serão recalculados.`" confirm-label="Excluir transação" :busy="deleting" @cancel="deletingTransaction = null" @confirm="confirmDelete" />
  <BankStatementImport v-if="showStatementImport" :categories="store.categories" :transactions="store.transactions" :busy="importingStatement" @close="showStatementImport = false" @import="importStatement" />
</template>
