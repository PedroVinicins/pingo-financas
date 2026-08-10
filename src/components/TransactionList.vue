<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-vue-next'
import type { Category, DebitCard, Transaction } from '../types/finance'

const props = withDefaults(defineProps<{
  transactions: Transaction[]
  categories: Category[]
  cards?: DebitCard[]
}>(), {
  cards: () => [],
})

function money(value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function categoryName(categoryId: string | null) {
  return props.categories.find((category) => category.id === categoryId)?.name ?? 'Sem categoria'
}

function cardName(cardId: string | null) {
  if (!cardId) return null
  const card = props.cards.find((item) => item.id === cardId)
  return card ? `${card.name} •••• ${card.lastFour}` : 'Cartão removido'
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
}
</script>

<template>
  <div v-if="transactions.length" class="divide-y divide-slate-100 dark:divide-slate-800">
    <div v-for="transaction in transactions" :key="transaction.id" class="flex items-center gap-3 py-4">
      <div
        class="grid size-11 shrink-0 place-items-center rounded-2xl"
        :class="transaction.kind === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' : 'bg-rose-100 text-rose-700 dark:bg-rose-950'"
      >
        <ArrowDownLeft v-if="transaction.kind === 'income'" :size="19" />
        <ArrowUpRight v-else :size="19" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold">{{ transaction.description }}</p>
        <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {{ categoryName(transaction.categoryId) }} · {{ shortDate(transaction.date) }}
          <template v-if="cardName(transaction.debitCardId)"> · {{ cardName(transaction.debitCardId) }}</template>
        </p>
      </div>

      <p
        class="shrink-0 text-sm font-bold sm:text-base"
        :class="transaction.kind === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'"
      >
        {{ transaction.kind === 'income' ? '+' : '-' }}{{ money(transaction.amount) }}
      </p>
    </div>
  </div>

  <div v-else class="grid min-h-48 place-items-center text-center text-slate-500">
    <div>
      <ReceiptText class="mx-auto mb-3" :size="28" />
      <p class="font-semibold">Nenhuma transação ainda</p>
      <p class="mt-1 text-sm">As movimentações aparecerão aqui.</p>
    </div>
  </div>
</template>
