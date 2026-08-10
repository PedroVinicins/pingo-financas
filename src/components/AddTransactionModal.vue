<script setup lang="ts">
import { reactive, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type {
  Category,
  DebitCard,
  NewTransactionInput,
  TransactionType,
  RecurrenceType,
} from '../types/finance'

const props = defineProps<{ categories: Category[]; cards: DebitCard[] }>()
const emit = defineEmits<{
  close: []
  save: [input: NewTransactionInput]
}>()

const defaultCardId = props.cards.find((card) => card.isDefault && !card.isFrozen)?.id ?? ''

const form = reactive({
  kind: 'expense' as TransactionType,
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  categoryId: '',
  debitCardId: defaultCardId,
  description: '',
  recurrence: 'variable' as RecurrenceType,
})

watch(() => form.kind, (kind) => {
  if (kind === 'income') form.debitCardId = ''
})

function submit() {
  const amount = form.amount.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return
  if (!form.description.trim()) return
  if (form.kind === 'expense' && !form.categoryId) return

  const selectedCard = props.cards.find((card) => card.id === form.debitCardId)
  if (selectedCard?.isFrozen) return

  emit('save', {
    kind: form.kind,
    amount,
    date: form.date,
    categoryId: form.categoryId || null,
    debitCardId: form.kind === 'expense' ? form.debitCardId || null : null,
    description: form.description.trim(),
    recurrence: form.recurrence,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 sm:place-items-center sm:p-4" @click.self="emit('close')">
    <form class="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-3xl" @submit.prevent="submit">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-emerald-600">Nova movimentação</p>
          <h2 class="text-xl font-black">Adicionar transação</h2>
        </div>
        <button type="button" class="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        <button type="button" class="rounded-xl px-3 py-2 text-sm font-bold" :class="form.kind === 'expense' ? 'bg-white shadow-sm dark:bg-slate-700' : ''" @click="form.kind = 'expense'">Despesa</button>
        <button type="button" class="rounded-xl px-3 py-2 text-sm font-bold" :class="form.kind === 'income' ? 'bg-white shadow-sm dark:bg-slate-700' : ''" @click="form.kind = 'income'">Entrada</button>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold">
          Valor
          <input v-model="form.amount" inputmode="decimal" placeholder="0,00" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Data
          <input v-model="form.date" type="date" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Descrição
          <input v-model="form.description" maxlength="160" placeholder="Ex.: Mercado" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Categoria
          <select v-model="form.categoryId" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="">Sem categoria</option>
            <option v-for="category in props.categories" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Natureza
          <select v-model="form.recurrence" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="variable">Variável</option>
            <option value="fixed">Fixa</option>
          </select>
        </label>
        <label v-if="form.kind === 'expense'" class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Meio de pagamento
          <select v-model="form.debitCardId" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="">Saldo / PIX / dinheiro</option>
            <option v-for="card in props.cards" :key="card.id" :value="card.id" :disabled="card.isFrozen">
              {{ card.name }} · {{ card.issuer }} · •••• {{ card.lastFour }}{{ card.isFrozen ? ' (congelado)' : '' }}
            </option>
          </select>
          <span class="text-xs font-normal text-slate-500">O cartão apenas identifica a compra; o valor sai do mesmo saldo da conta.</span>
        </label>
      </div>

      <button class="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400">
        Salvar transação
      </button>
    </form>
  </div>
</template>
