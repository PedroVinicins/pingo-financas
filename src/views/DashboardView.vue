<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  ArrowDownLeft, ArrowRightLeft, ArrowUpRight, CalendarClock, EyeOff, FileUp, Gauge,
  ChevronRight, GripVertical, Landmark, LayoutGrid, Maximize2, Pencil, PiggyBank, Plus, ReceiptText,
  ShieldCheck, Sparkles, TrendingDown, WalletCards, X,
} from 'lucide-vue-next'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import { formatCurrencyCents, privateCurrencyCents } from '../services/currency'
import type {
  BankStatementImportInput, DashboardWidgetId, DashboardWidgetSize, NewRecurringRuleInput,
  NewTransactionInput, Transaction, TransactionType,
} from '../types/finance'
import { cloneDashboardLayout, DASHBOARD_WIDGETS } from '../services/dashboardLayout'
import { greetingForHour } from '../services/deviceExperience'
import BalanceHeroCard from '../components/BalanceHeroCard.vue'
import MonthSelector from '../components/MonthSelector.vue'
import TransactionList from '../components/TransactionList.vue'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import EditBalanceModal from '../components/EditBalanceModal.vue'
import RecurringSection from '../components/RecurringSection.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import BankStatementImport from '../components/BankStatementImport.vue'
import CategoryIcon from '../components/CategoryIcon.vue'

const store = useFinanceStore()
const emit = defineEmits<{
  newTransaction: [kind?: TransactionType, flow?: 'transaction' | 'recurring' | 'vault']
  navigate: [view: 'accounts' | 'home' | 'analytics' | 'settings']
}>()
const showModal = ref(false)
const showBalanceEditor = ref(false)
const showStatementImport = ref(false)
const importingStatement = ref(false)
const customizing = ref(false)
const draggingWidget = ref<DashboardWidgetId | null>(null)
const touchDropTarget = ref<DashboardWidgetId | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
let pointerOrigin: { x: number; y: number } | null = null
const editingTransaction = ref<Transaction | null>(null)
const showAllHistory = ref(false)
const deletingTransaction = ref<Transaction | null>(null)
const deleting = ref(false)

function money(value: bigint) { return formatCurrencyCents(value, store.preferences.currency) }
function privateMoney(value: bigint) { return privateCurrencyCents(value, store.preferences.currency, store.balanceHidden) }
function widgetVisible(id: DashboardWidgetId) { return store.dashboardLayout.widgets.find((item) => item.id === id)?.visible !== false }
function widgetClass(size: DashboardWidgetSize) {
  return size === 'small' ? 'col-span-1 xl:col-span-3' : size === 'medium' ? 'col-span-2 xl:col-span-6' : 'col-span-2 xl:col-span-12'
}

const displayName = computed(() => store.preferences.displayName || 'Você')
const greeting = computed(() => store.preferences.greetingEnabled ? greetingForHour(new Date().getHours()) : 'Seu resumo')
const monthLabel = computed(() => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
  .format(new Date(store.reportingYear, store.reportingMonth - 1, 1)).replace('.', ''))
const visibleOptionalWidgets = computed(() => store.dashboardLayout.widgets.filter((item) =>
  item.visible && !['available_balance', 'net_worth', 'history'].includes(item.id)))
const hiddenWidgets = computed(() => store.dashboardLayout.widgets.filter((item) => !item.visible))
const historyTransactions = computed(() => showAllHistory.value ? store.sortedTransactions : store.sortedTransactions.slice(0, 5))
const categoryRows = computed(() => {
  const totals = new Map<string, bigint>()
  for (const transaction of store.reportingTransactions) {
    if (transaction.kind !== 'expense' || !transaction.categoryId) continue
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0n) + decimalToCents(transaction.amount))
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0n)
  return [...totals.entries()].sort((a, b) => Number(b[1] - a[1])).slice(0, 3).map(([id, amount]) => ({
    id, amount, category: store.categories.find((item) => item.id === id),
    percentage: total > 0n ? Number((amount * 10_000n) / total) / 100 : 0,
  }))
})
const budgetProgress = computed<number | null>(() => {
  if (!store.preferences.monthlyBudget) return null
  try {
    const limit = decimalToCents(store.preferences.monthlyBudget)
    return limit > 0n ? Number((store.reportingExpenseCents * 10_000n) / limit) / 100 : null
  } catch { return null }
})
const monthlyBudgetLabel = computed(() => {
  if (!store.preferences.monthlyBudget) return null
  try { return privateMoney(decimalToCents(store.preferences.monthlyBudget)) }
  catch { return null }
})
const scoreLabel = computed(() => store.financialHealthScore >= 80 ? 'Excelente' : store.financialHealthScore >= 60 ? 'Boa' : store.financialHealthScore >= 40 ? 'Em atenção' : 'Precisa de cuidado')

function changePeriod(year: number, month: number) { store.setReportingPeriod(year, month) }
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
async function sendToVault(input: { vaultId: string; amount: string }) {
  try { await store.moveVaultMoney({ id: input.vaultId, kind: 'deposit', amount: input.amount }); showModal.value = false }
  catch (cause) { store.reportError(cause, 'Não foi possível enviar o valor ao Porquinho.') }
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
  touchDropTarget.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function dropWidget(id: DashboardWidgetId, event: DragEvent) {
  const from = event.dataTransfer?.getData('text/plain') as DashboardWidgetId
  if (from) moveWidget(from, id)
  draggingWidget.value = null
  touchDropTarget.value = null
}
function dragEnd() {
  draggingWidget.value = null
  touchDropTarget.value = null
}
function pointerStart(id: DashboardWidgetId, event: PointerEvent) {
  if (event.pointerType === 'mouse') return
  event.preventDefault()
  draggingWidget.value = id
  touchDropTarget.value = id
  pointerOrigin = { x: event.clientX, y: event.clientY }
  dragOffset.value = { x: 0, y: 0 }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', pointerMove, { passive: false })
  window.addEventListener('pointerup', pointerEnd)
  window.addEventListener('pointercancel', pointerEnd)
}
function pointerMove(event: PointerEvent) {
  if (!draggingWidget.value || !pointerOrigin) return
  event.preventDefault()
  dragOffset.value = { x: event.clientX - pointerOrigin.x, y: event.clientY - pointerOrigin.y }
  const target = document.elementsFromPoint(event.clientX, event.clientY)
    .map((element) => element.closest<HTMLElement>('[data-dashboard-widget]'))
    .find((element) => element?.dataset.dashboardWidget !== draggingWidget.value)
  const id = target?.dataset.dashboardWidget as DashboardWidgetId | undefined
  if (id) touchDropTarget.value = id
}
function pointerEnd() {
  const from = draggingWidget.value
  const to = touchDropTarget.value
  if (from && to && from !== to) moveWidget(from, to)
  stopPointerTracking()
}
function stopPointerTracking() {
  draggingWidget.value = null
  touchDropTarget.value = null
  pointerOrigin = null
  dragOffset.value = { x: 0, y: 0 }
  window.removeEventListener('pointermove', pointerMove)
  window.removeEventListener('pointerup', pointerEnd)
  window.removeEventListener('pointercancel', pointerEnd)
}
function widgetDragStyle(id: DashboardWidgetId) {
  if (draggingWidget.value !== id || !pointerOrigin) return undefined
  return {
    transform: `translate3d(${dragOffset.value.x}px, ${dragOffset.value.y}px, 0) rotate(1deg) scale(1.035)`,
    transition: 'none',
  }
}
onBeforeUnmount(stopPointerTracking)
</script>

<template>
  <main class="mx-auto max-w-[1260px] px-5 pb-8 pt-[calc(2rem+env(safe-area-inset-top))] sm:px-8 lg:px-12 lg:py-10">
    <header class="mb-9 flex min-w-0 items-start justify-between gap-4">
      <div class="flex min-w-0 flex-1 items-center gap-3 lg:block">
        <img src="/pingo-icon.svg" alt="" class="size-11 shrink-0 rounded-2xl lg:hidden" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-subtle">{{ greeting }},</p>
          <h1 class="truncate text-[30px] font-extrabold leading-none tracking-[-0.045em] sm:text-[38px]">{{ displayName }}</h1>
          <p class="mt-1 hidden text-sm text-subtle lg:block">Aqui está o resumo das suas finanças.</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <MonthSelector :year="store.reportingYear" :month="store.reportingMonth" @change="changePeriod" />
        <button class="pingo-interactive grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-lg shadow-violet-500/25" aria-label="Nova transação" @click="emit('newTransaction', 'expense', 'transaction')"><Plus :size="22" stroke-width="2.5" /></button>
      </div>
    </header>

    <Transition enter-active-class="transition duration-300 ease-pingo" enter-from-class="-translate-y-2 opacity-0" leave-active-class="transition duration-200 ease-pingo" leave-to-class="-translate-y-2 opacity-0">
      <div v-if="customizing" class="-mt-4 mb-6 rounded-[1.5rem] border border-brand/30 bg-brand-soft p-4 text-sm shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><strong class="text-brand">Personalize do seu jeito</strong><p class="mt-1 text-xs text-subtle">Arraste, altere o tamanho ou oculte. Cada mudança é salva automaticamente.</p></div><button class="pingo-interactive grid size-10 shrink-0 place-items-center rounded-xl bg-surface" aria-label="Concluir personalização" @click="customizing = false"><X :size="18" /></button></div>
        <div v-if="hiddenWidgets.length" class="mt-3 flex flex-wrap gap-2"><button v-for="widget in hiddenWidgets" :key="widget.id" class="pingo-interactive inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-surface px-3 text-xs font-bold" @click="setVisibility(widget.id, true)"><Plus :size="14" /> {{ DASHBOARD_WIDGETS[widget.id].label }}</button></div>
      </div>
    </Transition>

    <section class="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div v-if="widgetVisible('available_balance') || widgetVisible('net_worth')" class="min-w-0 xl:col-span-8">
        <div v-if="customizing" class="mb-2 flex items-center gap-2 rounded-2xl border border-line bg-surface p-2"><span class="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><GripVertical :size="18" /></span><strong class="min-w-0 flex-1 truncate text-xs">Saldo e patrimônio</strong><button class="grid size-10 place-items-center rounded-xl text-subtle hover:bg-muted" aria-label="Ocultar saldo" @click="setVisibility('available_balance', false); setVisibility('net_worth', false)"><EyeOff :size="16" /></button></div>
        <BalanceHeroCard :balance="privateMoney(store.availableBalanceCents)" :month="monthLabel" :income="privateMoney(store.reportingIncomeCents)" :expense="privateMoney(store.reportingExpenseCents)" :net-worth="widgetVisible('net_worth') ? privateMoney(store.balanceCents) : ''" :hidden="store.balanceHidden" :budget-progress="budgetProgress" @toggle-privacy="store.toggleBalanceVisibility" @details="emit('navigate', 'analytics')" />
      </div>

      <aside class="soft-shadow min-w-0 rounded-[var(--radius)] border border-line bg-surface p-6 xl:col-span-4">
        <div class="mb-5 flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold">Acesso rápido</h2>
          <div class="flex items-center gap-2">
            <span v-if="budgetProgress !== null" class="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{{ Math.round(budgetProgress) }}% usado</span>
            <button class="grid size-9 place-items-center rounded-xl bg-muted text-subtle" aria-label="Personalizar início" @click="customizing = !customizing"><LayoutGrid :size="18" /></button>
          </div>
        </div>
        <div class="space-y-3">
          <button class="pingo-interactive flex min-h-14 w-full items-center gap-3 rounded-2xl bg-muted px-4 text-left font-semibold" @click="emit('newTransaction', 'expense', 'transaction')"><span class="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand"><ArrowUpRight :size="18" /></span><span class="min-w-0 flex-1 truncate">Adicionar gasto</span><ChevronRight :size="18" class="shrink-0 text-subtle" /></button>
          <button class="pingo-interactive flex min-h-14 w-full items-center gap-3 rounded-2xl bg-muted px-4 text-left font-semibold" @click="emit('newTransaction', 'income', 'transaction')"><span class="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand"><ArrowDownLeft :size="18" /></span><span class="min-w-0 flex-1 truncate">Adicionar entrada</span><ChevronRight :size="18" class="shrink-0 text-subtle" /></button>
          <button class="pingo-interactive flex min-h-14 w-full items-center gap-3 rounded-2xl bg-muted px-4 text-left font-semibold" @click="emit('newTransaction', 'expense', 'vault')"><span class="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand"><ArrowRightLeft :size="18" /></span><span class="min-w-0 flex-1 truncate">Fazer transferência</span><ChevronRight :size="18" class="shrink-0 text-subtle" /></button>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="pingo-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line px-3 text-xs font-bold hover:bg-muted" @click="showStatementImport = true"><FileUp :size="16" class="text-brand" /> Importar</button>
          <button class="pingo-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line px-3 text-xs font-bold hover:bg-muted" @click="showBalanceEditor = true"><Pencil :size="16" class="text-brand" /> Corrigir saldo</button>
        </div>
      </aside>
    </section>

    <section class="mt-12 grid grid-cols-1 gap-5 xl:grid-cols-8">
      <article v-if="widgetVisible('history')" class="min-w-0 xl:col-span-5">
        <div class="mb-4 flex items-center justify-between gap-3"><h2 class="truncate text-[23px] font-bold tracking-tight">{{ showAllHistory ? 'Histórico completo' : 'Últimas transações' }}</h2><button v-if="store.sortedTransactions.length > 5" class="min-h-11 shrink-0 cursor-pointer px-2 text-sm font-bold text-brand hover:underline" @click="showAllHistory = !showAllHistory">{{ showAllHistory ? 'Ver 5' : 'Ver todas' }}</button></div>
        <TransactionList :transactions="historyTransactions" :categories="store.categories" :cards="store.debitCards" editable @edit="edit" />
      </article>

      <aside class="soft-shadow min-w-0 rounded-[var(--radius)] border border-line bg-surface p-6 xl:col-span-3">
        <h2 class="text-lg font-bold">Resumo do mês</h2>
        <div class="mt-6">
          <p class="text-sm text-subtle">Economia no mês</p>
          <p class="mt-1 truncate text-2xl font-extrabold tabular-nums" :class="store.reportingBalanceCents >= 0n ? '' : 'text-red-500'">{{ privateMoney(store.reportingBalanceCents) }}</p>
        </div>
        <div v-if="budgetProgress !== null && monthlyBudgetLabel" class="mt-6">
          <div class="mb-2 flex min-w-0 justify-between gap-3 text-sm"><span class="text-subtle">Limite mensal</span><strong class="truncate tabular-nums">{{ monthlyBudgetLabel }}</strong></div>
          <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full bg-brand transition-[width] duration-300" :style="{ width: `${Math.min(budgetProgress, 100)}%` }"></div></div>
        </div>
        <div v-if="categoryRows.length" class="mt-6"><p class="mb-3 text-sm text-subtle">Maiores categorias</p><div class="grid gap-3"><div v-for="row in categoryRows" :key="row.id" class="flex min-w-0 items-center gap-2 text-sm"><CategoryIcon :category="row.category" kind="expense" :size="15" /><span class="min-w-0 flex-1 truncate">{{ row.category?.name ?? 'Sem categoria' }}</span><strong class="shrink-0 tabular-nums">{{ privateMoney(row.amount) }}</strong></div></div></div>
        <p v-else class="mt-6 rounded-2xl bg-muted p-4 text-sm text-subtle">Nenhuma movimentação neste mês.</p>
      </aside>
    </section>

    <TransitionGroup v-if="visibleOptionalWidgets.length" tag="section" appear class="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-12" enter-active-class="transition duration-300 ease-pingo" enter-from-class="translate-y-3 scale-[.98] opacity-0" leave-active-class="transition duration-200 ease-pingo" leave-to-class="translate-y-3 scale-[.98] opacity-0" move-class="transition-transform duration-500 ease-pingo">
      <div v-for="widget in visibleOptionalWidgets" :key="widget.id" :data-dashboard-widget="widget.id" class="relative min-w-0 will-change-transform transition-[filter,opacity,box-shadow] duration-200 ease-pingo" :class="[widgetClass(widget.size), draggingWidget === widget.id ? 'z-40 cursor-grabbing opacity-95 drop-shadow-2xl' : '', touchDropTarget === widget.id && draggingWidget !== widget.id ? 'rounded-pingo-lg ring-2 ring-brand ring-offset-4 ring-offset-canvas' : '']" :style="widgetDragStyle(widget.id)" @dragenter.prevent="touchDropTarget = widget.id" @dragover.prevent @drop="dropWidget(widget.id, $event)">
        <div v-if="customizing" class="mb-2 flex items-center gap-2 rounded-2xl border border-brand/25 bg-surface p-2 shadow-sm transition duration-200 ease-pingo" :class="draggingWidget === widget.id ? 'border-brand bg-brand-soft shadow-lg' : ''"><button draggable="true" class="grid size-10 touch-none cursor-grab place-items-center rounded-xl bg-brand-soft text-brand active:cursor-grabbing active:scale-95" :aria-label="`Arrastar ${DASHBOARD_WIDGETS[widget.id].label}`" @dragstart="dragStart(widget.id, $event)" @dragend="dragEnd" @pointerdown="pointerStart(widget.id, $event)"><GripVertical :size="18" /></button><strong class="min-w-0 flex-1 truncate text-xs">{{ DASHBOARD_WIDGETS[widget.id].label }}</strong><button class="pingo-interactive inline-flex h-10 items-center gap-1 rounded-xl bg-muted px-2 text-[10px] font-bold" @click="cycleSize(widget.id)"><Maximize2 :size="14" /> {{ widget.size === 'small' ? 'P' : widget.size === 'medium' ? 'M' : 'G' }}</button><button class="pingo-interactive grid size-10 place-items-center rounded-xl text-subtle hover:bg-muted" @click="setVisibility(widget.id, false)"><EyeOff :size="16" /></button></div>

        <article v-if="widget.id === 'vault_total'" class="pingo-card min-h-40 p-5"><PiggyBank :size="21" class="text-brand" /><p class="mt-5 text-xs font-semibold text-subtle">Nos porquinhos</p><p class="mt-1 truncate text-2xl font-extrabold tabular-nums" :title="privateMoney(store.vaultTotalCents)">{{ privateMoney(store.vaultTotalCents) }}</p></article>
        <article v-else-if="widget.id === 'month_expenses'" class="pingo-card min-h-40 p-5"><TrendingDown :size="21" class="text-brand" /><p class="mt-5 text-xs font-semibold text-subtle">Gastos no período</p><p class="mt-1 truncate text-2xl font-extrabold tabular-nums">{{ privateMoney(store.reportingExpenseCents) }}</p></article>
        <article v-else-if="widget.id === 'daily_budget'" class="min-h-40 rounded-pingo-lg bg-brand p-5 text-white shadow-card"><CalendarClock :size="21" /><p class="mt-5 text-xs font-semibold text-white/60">Posso gastar hoje</p><p class="mt-1 truncate text-2xl font-extrabold tabular-nums">{{ privateMoney(store.dailyBudgetCents) }}</p></article>
        <article v-else-if="widget.id === 'month_balance'" class="pingo-card min-h-40 p-5"><Landmark :size="21" class="text-brand" /><p class="mt-5 text-xs font-semibold text-subtle">Resultado do período</p><p class="mt-1 truncate text-2xl font-extrabold tabular-nums">{{ privateMoney(store.reportingBalanceCents) }}</p></article>
        <div v-else-if="widget.id === 'recurring'"><RecurringSection /></div>
        <article v-else-if="widget.id === 'insights'" class="pingo-card p-5"><div class="flex items-start justify-between"><div><p class="text-sm font-semibold text-brand">Leituras do Pingo</p><h3 class="text-xl font-extrabold">Saúde financeira</h3></div><Gauge :size="23" /></div><div class="mt-5 grid grid-cols-2 gap-3"><div class="rounded-2xl bg-muted p-4"><ShieldCheck :size="16" class="text-subtle" /><p class="mt-2 text-2xl font-extrabold">{{ store.financialHealthScore }}<span class="text-sm text-subtle">/100</span></p><p class="text-xs font-bold text-brand">{{ scoreLabel }}</p></div><div class="rounded-2xl bg-muted p-4"><Sparkles :size="16" class="text-subtle" /><p class="mt-2 truncate text-lg font-extrabold">{{ privateMoney(store.fixedMonthlyCommitmentCents) }}</p><p class="text-xs text-subtle">Fixos previstos</p></div></div></article>
      </div>
    </TransitionGroup>

    <section v-if="!widgetVisible('available_balance') && !widgetVisible('net_worth') && !widgetVisible('history') && !visibleOptionalWidgets.length" class="mt-8 grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-line bg-surface p-8 text-center"><div><LayoutGrid :size="38" class="mx-auto text-brand" /><h2 class="mt-4 text-xl font-extrabold">Seu início está vazio</h2><p class="mt-1 text-sm text-subtle">Reative apenas os blocos que você quer acompanhar.</p><button class="mt-4 rounded-2xl bg-brand px-5 py-3 font-bold text-white" @click="customizing = true">Personalizar</button></div></section>
  </main>

  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :vaults="store.vaults" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" @send-to-vault="sendToVault" @delete="deletingTransaction = $event" />
  <EditBalanceModal v-if="showBalanceEditor" :current-balance="centsToDecimal(store.availableBalanceCents)" @close="showBalanceEditor = false" @save="editBalance" />
  <ConfirmDialog v-if="deletingTransaction" title="Excluir transação?" :message="`“${deletingTransaction.description}” será removida e os saldos serão recalculados.`" confirm-label="Excluir transação" :busy="deleting" @cancel="deletingTransaction = null" @confirm="confirmDelete" />
  <BankStatementImport v-if="showStatementImport" :categories="store.categories" :cards="store.debitCards" :transactions="store.transactions" :busy="importingStatement" @close="showStatementImport = false" @import="importStatement" />
</template>
