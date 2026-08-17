<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, Pencil, ReceiptText } from 'lucide-vue-next'
import type { Category, DebitCard, Transaction } from '../types/finance'

const props = withDefaults(defineProps<{
  transactions: Transaction[]
  categories: Category[]
  cards?: DebitCard[]
  editable?: boolean
}>(), {
  cards: () => [],
  editable: false,
})
const emit = defineEmits<{ edit: [transaction: Transaction] }>()

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

function shortDate(value: string, occurredAt: string | null) {
  if (occurredAt) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(occurredAt))
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
}
</script>

<template>
  <div v-if="transactions.length" class="grid min-w-0 gap-3">
    <article
      v-for="transaction in transactions"
      :key="transaction.id"
      class="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.5rem] items-center gap-3 overflow-hidden rounded-[1.25rem] border border-line bg-surface p-3.5 sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(6rem,auto)_2.5rem] sm:p-4"
    >
      <div
        class="grid size-11 shrink-0 place-items-center rounded-2xl"
        :class="transaction.kind === 'income' ? 'bg-brand-soft text-brand' : 'bg-muted text-ink'"
      >
        <ArrowDownLeft v-if="transaction.kind === 'income'" :size="19" />
        <ArrowUpRight v-else :size="19" />
      </div>

      <div class="min-w-0 overflow-hidden">
        <div class="flex min-w-0 items-start gap-2 sm:block">
          <p class="min-w-0 flex-1 truncate font-semibold" :title="transaction.description">{{ transaction.description }}</p>
          <p
            class="max-w-[48%] shrink-0 truncate text-right text-sm font-bold tabular-nums sm:hidden"
            :class="transaction.kind === 'income' ? 'text-brand' : 'text-ink'"
            :title="`${transaction.kind === 'income' ? '+' : '-'}${money(transaction.amount)}`"
          >
            {{ transaction.kind === 'income' ? '+' : '-' }}{{ money(transaction.amount) }}
          </p>
        </div>
        <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {{ categoryName(transaction.categoryId) }} · {{ shortDate(transaction.date, transaction.occurredAt) }}
          <template v-if="cardName(transaction.debitCardId)"> · {{ cardName(transaction.debitCardId) }}</template>
        </p>
      </div>

      <p
        class="hidden min-w-0 max-w-[12rem] truncate text-right text-sm font-bold tabular-nums sm:block sm:text-base"
        :class="transaction.kind === 'income' ? 'text-brand' : 'text-ink'"
        :title="`${transaction.kind === 'income' ? '+' : '-'}${money(transaction.amount)}`"
      >
        {{ transaction.kind === 'income' ? '+' : '-' }}{{ money(transaction.amount) }}
      </p>
      <button v-if="editable" class="grid size-10 shrink-0 place-items-center rounded-xl text-subtle transition hover:bg-muted hover:text-ink" :aria-label="`Editar ${transaction.description}`" @click="emit('edit', transaction)"><Pencil :size="15" /></button>
      <span v-else aria-hidden="true" class="size-10"></span>
    </article>
  </div>

  <div v-else class="grid min-h-48 place-items-center text-center text-slate-500">
    <div>
      <ReceiptText class="mx-auto mb-3" :size="28" />
      <p class="font-semibold">Nenhuma transação ainda</p>
      <p class="mt-1 text-sm">As movimentações aparecerão aqui.</p>
    </div>
  </div>
</template>
