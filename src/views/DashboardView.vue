<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, WalletCards } from 'lucide-vue-next'
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
