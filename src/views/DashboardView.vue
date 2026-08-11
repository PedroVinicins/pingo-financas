<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarClock, Gauge, PiggyBank, Plus, ShieldCheck, TrendingUp, WalletCards } from 'lucide-vue-next'
import { useFinanceStore, centsToDecimal } from '../stores/financeStore'
import type { NewTransactionInput } from '../types/finance'
import SummaryCard from '../components/SummaryCard.vue'
import TransactionList from '../components/TransactionList.vue'
import AddTransactionModal from '../components/AddTransactionModal.vue'

const store = useFinanceStore()
const showModal = ref(false)

const balance = computed(() => formatMoney(centsToDecimal(store.balanceCents)))
const monthBalance = computed(() => formatMoney(centsToDecimal(store.currentMonthBalanceCents)))
const expenseTotal = computed(() => {
  let total = 0n
  for (const value of store.expensesByCategory.values()) total += value
  return formatMoney(centsToDecimal(total))
})
const dailyBudget = computed(() => formatMoney(centsToDecimal(store.dailyBudgetCents)))
const projectedExpenses = computed(() => formatMoney(centsToDecimal(store.projectedMonthExpenseCents)))
const reserved = computed(() => formatMoney(centsToDecimal(store.vaultTotalCents)))
const scoreLabel = computed(() => {
  if (store.financialHealthScore >= 80) return 'Excelente'
  if (store.financialHealthScore >= 60) return 'Boa'
  if (store.financialHealthScore >= 40) return 'Em atenção'
  return 'Precisa de cuidado'
})

function formatMoney(value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

async function save(input: NewTransactionInput) {
  await store.createTransaction(input)
  showModal.value = false
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
    <section class="overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-card dark:bg-slate-900 sm:p-8">
      <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="mb-5 grid size-11 place-items-center rounded-2xl bg-white/10">
            <WalletCards :size="21" />
          </div>
          <p class="text-sm font-medium text-slate-400">Saldo atual</p>
          <h2 class="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{{ balance }}</h2>
          <p class="mt-3 text-sm text-slate-400">Todos os meios de pagamento partem deste mesmo saldo.</p>
        </div>

        <button class="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300" @click="showModal = true">
          <Plus :size="19" />
          Adicionar transação
        </button>
      </div>
    </section>

    <section class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryCard label="Balanço do mês" :value="monthBalance" hint="Entradas menos despesas no mês atual" />
      <SummaryCard label="Despesas registradas" :value="expenseTotal" hint="Total por categorias" />
      <SummaryCard label="Transações" :value="String(store.transactions.length)" :hint="`${store.debitCards.length} cartão(ões) na carteira`" />
    </section>

    <section class="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div class="flex items-start justify-between gap-4"><div><p class="text-sm font-bold text-emerald-600">Inteligência financeira</p><h3 class="text-xl font-black">Seu ritmo neste mês</h3></div><div class="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Gauge :size="23" /></div></div>
      <div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><ShieldCheck :size="15" /> Saúde financeira</div><p class="mt-2 text-2xl font-black">{{ store.financialHealthScore }}<span class="text-sm text-slate-400">/100</span></p><p class="mt-1 text-xs font-bold text-emerald-600">{{ scoreLabel }}</p></div>
        <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><CalendarClock :size="15" /> Pode gastar por dia</div><p class="mt-2 text-xl font-black">{{ dailyBudget }}</p><p class="mt-1 text-xs text-slate-500">Saldo livre ÷ dias restantes</p></div>
        <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><TrendingUp :size="15" /> Projeção de despesas</div><p class="mt-2 text-xl font-black">{{ projectedExpenses }}</p><p class="mt-1 text-xs text-slate-500">No ritmo atual até o fim do mês</p></div>
        <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div class="flex items-center gap-2 text-xs font-bold text-slate-400"><PiggyBank :size="15" /> Guardado em cofres</div><p class="mt-2 text-xl font-black">{{ reserved }}</p><p class="mt-1 text-xs text-slate-500">{{ store.emergencyFundMonths.toFixed(1) }} meses de despesas</p></div>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div class="flex items-center justify-between text-sm font-bold"><span>Taxa de economia</span><span :class="store.savingsRate >= 20 ? 'text-emerald-600' : 'text-amber-600'">{{ store.savingsRate.toFixed(1) }}%</span></div><p class="mt-1 text-xs text-slate-500">O ideal inicial é guardar pelo menos 20% das entradas.</p></div><div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div class="flex items-center justify-between text-sm font-bold"><span>Comprometido com gastos fixos</span><span :class="store.fixedCostRatio <= 50 ? 'text-emerald-600' : 'text-rose-600'">{{ store.fixedCostRatio.toFixed(1) }}%</span></div><p class="mt-1 text-xs text-slate-500">Quanto menor, maior sua flexibilidade no mês.</p></div></div>
    </section>

    <section class="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Histórico</p>
          <h3 class="text-xl font-black">Transações recentes</h3>
        </div>
        <span class="text-sm font-bold text-emerald-600">Atualizado</span>
      </div>
      <TransactionList :transactions="store.recentTransactions" :categories="store.categories" :cards="store.debitCards" />
    </section>
  </main>

  <AddTransactionModal
    v-if="showModal"
    :categories="store.categories"
    :cards="store.debitCards"
    @close="showModal = false"
    @save="save"
  />
</template>
