<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, ChartPie, Clock3, Flame,
  PiggyBank, Plus, ReceiptText, ShieldCheck, Sparkles, Target, TrendingDown, Wallet,
} from 'lucide-vue-next'
import AddTransactionModal from '../components/AddTransactionModal.vue'
import TransactionList from '../components/TransactionList.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { decimalToCents, useFinanceStore } from '../stores/financeStore'
import { analyzeAccount } from '../services/accountAnalysis'
import { privateCurrencyCents } from '../services/currency'
import type { NewRecurringRuleInput, NewTransactionInput, Transaction } from '../types/finance'

const store = useFinanceStore()
const showModal = ref(false)
const editingTransaction = ref<Transaction | null>(null)
const deletingTransaction = ref<Transaction | null>(null)
const deleting = ref(false)

function privateMoney(value: bigint) { return privateCurrencyCents(value, store.preferences.currency, store.balanceHidden) }
const safeSavingsCents = computed(() => store.reportingBalanceCents > 0n ? store.reportingBalanceCents : 0n)
const savingTargetCents = computed(() => store.reportingIncomeCents / 5n)
const remainingTargetCents = computed(() => {
  const remaining = savingTargetCents.value - safeSavingsCents.value
  return remaining > 0n ? remaining : 0n
})
const savingsProgress = computed(() => savingTargetCents.value > 0n
  ? Math.min(100, Number((safeSavingsCents.value * 10_000n) / savingTargetCents.value) / 100)
  : 0)
const currentTransactions = computed(() => store.reportingTransactions)
const expenseRules = computed(() => store.recurringRules
  .filter((rule) => rule.active && rule.kind === 'expense')
  .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)))
const accountAnalysis = computed(() => analyzeAccount({
  transactions: currentTransactions.value,
  categories: store.categories,
  year: store.reportingYear,
  month: store.reportingMonth,
  formatMoney: privateMoney,
}))
const incomeCategoryRows = computed(() => accountAnalysis.value.categoryFlows.filter((item) => item.kind === 'income'))
const expenseCategoryRows = computed(() => accountAnalysis.value.categoryFlows.filter((item) => item.kind === 'expense'))
const timeRows = computed(() => accountAnalysis.value.spendingByTime.filter((item) => item.transactionCount > 0))
const pingoRadarMessage = computed(() => accountAnalysis.value.headline)
const largestExpenseCents = computed(() => accountAnalysis.value.largestExpense
  ? decimalToCents(accountAnalysis.value.largestExpense.amount) : 0n)

function alertClass(severity: 'critical' | 'warning' | 'info' | 'positive') {
  return ({
    critical: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100',
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  })[severity]
}

async function save(input: NewTransactionInput) {
  try {
    if (editingTransaction.value) await store.editTransaction({ id: editingTransaction.value.id, ...input })
    else await store.createTransaction(input)
    showModal.value = false
    editingTransaction.value = null
  } catch (cause) { store.reportError(cause, 'Não foi possível salvar.') }
}
async function saveRecurring(input: NewRecurringRuleInput) {
  try {
    await store.createRecurringRule(input)
    showModal.value = false
  } catch (cause) { store.reportError(cause, 'Não foi possível ligar o Piloto Mensal.') }
}
function edit(transaction: Transaction) { editingTransaction.value = transaction; showModal.value = true }
async function confirmDelete() {
  if (!deletingTransaction.value) return
  deleting.value = true
  try {
    await store.deleteTransaction(deletingTransaction.value.id)
    showModal.value = false
    editingTransaction.value = null
    deletingTransaction.value = null
    store.showFeedback('Despesa excluída e indicadores atualizados.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível excluir a transação.') }
  finally { deleting.value = false }
}
function dueDate(value: string) { return value.split('-').reverse().join('/') }
</script>

<template>
  <main class="mx-auto max-w-[1440px] px-5 pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-7 sm:py-8 lg:px-10">
    <section class="relative overflow-hidden rounded-[2rem] bg-hero p-6 text-white shadow-float sm:p-8">
      <div class="absolute right-0 top-0 size-52 rounded-full bg-brand/15 blur-3xl"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div>
          <p class="flex items-center gap-2 text-sm font-bold text-violet-300"><ChartPie :size="17" /> Análises</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Gastos & economias</h2>
          <p class="mt-2 max-w-xl text-sm text-white/55">Descubra para onde o dinheiro foi e quanto conseguiu ficar.</p>
        </div>
        <button class="hidden shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 sm:flex" @click="showModal = true"><Plus :size="18" /> Registrar</button>
      </div>
      <div class="relative mt-6 flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
        <img src="/pingo-icon.svg" alt="" class="size-11 shrink-0 rounded-2xl" />
        <div><p class="text-xs font-bold uppercase tracking-wider text-violet-300"><Sparkles :size="13" class="mr-1 inline" /> Pingo analisou</p><p class="mt-1 text-sm font-semibold leading-relaxed">{{ pingoRadarMessage }}</p></div>
      </div>
    </section>

    <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><Flame :size="15" /> Gastou no período</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(store.reportingExpenseCents) }}</p></article>
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><ShieldCheck :size="15" /> Economizou</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(safeSavingsCents) }}</p></article>
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><PiggyBank :size="15" /> Nos porquinhos</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(store.vaultTotalCents) }}</p></article>
      <article class="pingo-card p-4"><div class="flex items-center gap-2 text-xs font-bold text-brand"><TrendingDown :size="15" /> Média diária</div><p class="mt-2 truncate text-xl font-extrabold">{{ privateMoney(store.dailySpendingAverageCents) }}</p></article>
    </section>

    <section class="mt-5 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-card">
      <div class="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <p class="flex items-center gap-2 text-sm font-bold text-brand"><Target :size="17" /> Missão: guardar 20%</p>
          <h3 class="mt-1 text-2xl font-black">{{ savingsProgress.toFixed(0) }}% da missão concluída</h3>
          <p v-if="savingTargetCents > 0n" class="mt-1 text-sm text-slate-500">Meta {{ privateMoney(savingTargetCents) }} · faltam {{ privateMoney(remainingTargetCents) }}</p>
          <p v-else class="mt-1 text-sm text-slate-500">Registre uma entrada para o Pingo calcular a meta do mês.</p>
        </div>
        <div class="grid size-20 place-items-center rounded-[1.5rem] bg-brand-soft text-3xl">🐷</div>
      </div>
      <div class="h-3 bg-muted"><div class="h-full rounded-r-full bg-brand transition-all" :style="{ width: `${savingsProgress}%` }"></div></div>
    </section>

    <section class="mt-5 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div class="flex items-start justify-between gap-3"><div><p class="flex items-center gap-2 text-sm font-bold text-brand"><AlertTriangle :size="17" /> Diagnóstico do período</p><h3 class="mt-1 text-xl font-black">O que merece sua atenção</h3><p class="mt-1 text-xs text-subtle">Sinais calculados pelos registros; não são cobranças nem movimentações bancárias.</p></div><span class="rounded-full bg-muted px-3 py-1 text-xs font-bold text-subtle">{{ accountAnalysis.transactionCount }} registros</span></div>
      <div class="mt-5 grid gap-3 lg:grid-cols-2">
        <article v-for="alert in accountAnalysis.alerts" :key="alert.id" class="rounded-2xl border p-4" :class="alertClass(alert.severity)">
          <div class="flex items-start gap-3"><AlertTriangle v-if="alert.severity === 'critical' || alert.severity === 'warning'" :size="18" class="mt-0.5 shrink-0" /><ShieldCheck v-else :size="18" class="mt-0.5 shrink-0" /><div><h4 class="text-sm font-black">{{ alert.title }}</h4><p class="mt-1 text-xs leading-relaxed opacity-80">{{ alert.message }}</p></div></div>
        </article>
      </div>
      <dl v-if="accountAnalysis.expenseCount" class="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 lg:grid-cols-4">
        <div class="rounded-2xl bg-muted p-3"><dt class="text-[11px] font-bold text-subtle">Média por saída</dt><dd class="mt-1 truncate font-black">{{ privateMoney(accountAnalysis.averageExpenseCents) }}</dd></div>
        <div class="rounded-2xl bg-muted p-3"><dt class="text-[11px] font-bold text-subtle">Valor mediano</dt><dd class="mt-1 truncate font-black">{{ privateMoney(accountAnalysis.medianExpenseCents) }}</dd></div>
        <div class="rounded-2xl bg-muted p-3"><dt class="text-[11px] font-bold text-subtle">Maior saída</dt><dd class="mt-1 truncate font-black">{{ privateMoney(largestExpenseCents) }}</dd></div>
        <div class="rounded-2xl bg-muted p-3"><dt class="text-[11px] font-bold text-subtle">Despesas fixas</dt><dd class="mt-1 truncate font-black">{{ privateMoney(accountAnalysis.fixedExpenseCents) }}</dd></div>
      </dl>
    </section>

    <section class="mt-5 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold text-brand">Categorias conectadas</p><h3 class="text-xl font-black">De onde veio e para onde foi</h3><p class="mt-1 text-xs text-subtle">Receitas e gastos aparecem juntos, mantendo cada lançamento no tipo correto.</p></div><div class="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand"><ChartPie :size="21" /></div></div>
      <div class="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div>
          <h4 class="flex items-center gap-2 text-sm font-black text-emerald-600"><ArrowDownLeft :size="17" /> Categorias de entrada · {{ privateMoney(accountAnalysis.incomeCents) }}</h4>
          <div v-if="incomeCategoryRows.length" class="mt-4 grid gap-4">
            <div v-for="row in incomeCategoryRows" :key="row.id">
              <div class="mb-1.5 flex items-center justify-between gap-3 text-sm"><span class="truncate font-bold">{{ row.name }} <small class="text-subtle">· {{ row.transactionCount }}x</small></span><span class="shrink-0 font-black">{{ privateMoney(row.amountCents) }} · {{ row.percentage.toFixed(0) }}%</span></div>
              <div class="h-2.5 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full" :style="{ width: `${row.percentage}%`, backgroundColor: row.color }"></div></div>
            </div>
          </div>
          <p v-else class="mt-4 rounded-2xl bg-muted p-4 text-sm text-subtle">Nenhuma entrada categorizada no período.</p>
        </div>
        <div>
          <h4 class="flex items-center gap-2 text-sm font-black text-rose-600"><ArrowUpRight :size="17" /> Categorias de saída · {{ privateMoney(accountAnalysis.expenseCents) }}</h4>
          <div v-if="expenseCategoryRows.length" class="mt-4 grid gap-4">
            <div v-for="row in expenseCategoryRows" :key="row.id">
              <div class="mb-1.5 flex items-center justify-between gap-3 text-sm"><span class="truncate font-bold">{{ row.name }} <small class="text-subtle">· {{ row.transactionCount }}x</small></span><span class="shrink-0 font-black">{{ privateMoney(row.amountCents) }} · {{ row.percentage.toFixed(0) }}%</span></div>
              <div class="h-2.5 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full" :style="{ width: `${row.percentage}%`, backgroundColor: row.color }"></div></div>
            </div>
          </div>
          <p v-else class="mt-4 rounded-2xl bg-muted p-4 text-sm text-subtle">Nenhuma saída categorizada no período.</p>
        </div>
      </div>
    </section>

    <div class="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <section class="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
        <div class="flex items-start justify-between gap-3"><div><p class="flex items-center gap-2 text-sm font-bold text-brand"><Clock3 :size="17" /> Horários das saídas</p><h3 class="text-xl font-black">Quando o dinheiro saiu</h3></div><span class="text-xs font-bold text-subtle">{{ accountAnalysis.expenseCount }} saídas</span></div>
        <div v-if="timeRows.length" class="mt-5 grid gap-4">
          <div v-for="row in timeRows" :key="row.id">
            <div class="mb-1.5 flex items-center justify-between gap-3 text-sm"><span class="font-bold">{{ row.label }} <small class="text-subtle">· {{ row.transactionCount }}x</small></span><span class="shrink-0 font-black">{{ privateMoney(row.amountCents) }} · {{ row.percentage.toFixed(0) }}%</span></div>
            <div class="h-2.5 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full bg-brand" :style="{ width: `${row.percentage}%` }"></div></div>
          </div>
        </div>
        <p v-else class="mt-4 rounded-2xl bg-muted p-4 text-sm text-subtle">Registre saídas com data e hora para enxergar os períodos de maior gasto.</p>
        <div v-if="accountAnalysis.largestExpense" class="mt-5 rounded-2xl border border-line p-4"><p class="text-xs font-bold text-subtle">Maior impacto individual</p><p class="mt-1 truncate font-black">{{ accountAnalysis.largestExpense.description }}</p><p class="mt-1 text-sm text-brand">{{ privateMoney(largestExpenseCents) }} · {{ accountAnalysis.largestExpense.occurredAt?.slice(11, 16) ?? 'hora não informada' }}</p></div>
      </section>

      <section class="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
        <div><p class="text-sm font-bold text-violet-600">Piloto Mensal</p><h3 class="text-xl font-black">Contas no radar</h3></div>
        <div v-if="expenseRules.length" class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          <div v-for="rule in expenseRules" :key="rule.id" class="flex items-center gap-3 py-3"><div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950"><CalendarClock :size="17" /></div><div class="min-w-0 flex-1"><p class="truncate text-sm font-black">{{ rule.description }}</p><p class="text-xs text-slate-500">{{ dueDate(rule.nextDueDate) }}</p></div><strong class="text-sm">{{ privateMoney(decimalToCents(rule.amount)) }}</strong></div>
        </div>
        <div v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">Nenhuma conta recorrente. Suspeito… mas gostei. 👀</div>
        <div class="mt-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30"><div class="flex items-center gap-2 text-xs font-black text-violet-600"><Wallet :size="15" /> Compromisso previsto</div><p class="mt-2 text-xl font-black">{{ privateMoney(store.fixedMonthlyCommitmentCents) }}</p></div>
      </section>
    </div>

    <section class="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div class="mb-2 flex items-start justify-between gap-3"><div><p class="text-sm font-bold text-slate-500">Fluxo completo</p><h3 class="text-xl font-black">Entradas e saídas recentes</h3></div><div class="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800"><ReceiptText :size="20" /></div></div>
      <TransactionList :transactions="currentTransactions.slice(0, 10)" :categories="store.categories" :cards="store.debitCards" editable @edit="edit" />
    </section>
  </main>

  <button class="fixed bottom-28 right-4 z-30 grid size-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-xl sm:hidden" aria-label="Registrar entrada ou saída" @click="showModal = true"><Plus :size="25" /></button>
  <AddTransactionModal v-if="showModal" :categories="store.categories" :cards="store.debitCards" :transaction="editingTransaction" @close="showModal = false; editingTransaction = null" @save="save" @save-recurring="saveRecurring" @delete="deletingTransaction = $event" />
  <ConfirmDialog v-if="deletingTransaction" title="Excluir transação?" :message="`“${deletingTransaction.description}” será removida e os indicadores do mês serão recalculados.`" confirm-label="Excluir transação" :busy="deleting" @cancel="deletingTransaction = null" @confirm="confirmDelete" />
</template>
