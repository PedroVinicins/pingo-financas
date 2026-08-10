<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Banknote, Check, ChevronDown, CreditCard, X, Zap } from 'lucide-vue-next'
import type { Category, DebitCard, NewTransactionInput } from '../types/finance'

const props = defineProps<{
  categories: Category[]
  cards: DebitCard[]
  recentCategoryIds?: string[]
  initialCardId?: string
}>()

const emit = defineEmits<{ close: []; save: [input: NewTransactionInput] }>()
const amountInput = ref<HTMLInputElement | null>(null)
const defaultCategory = props.recentCategoryIds?.[0]
  ?? props.categories.find((item) => item.name.toLowerCase().includes('alimenta'))?.id
  ?? props.categories[0]?.id
  ?? ''
const defaultCard = props.initialCardId && props.cards.some((item) => item.id === props.initialCardId && !item.isFrozen)
  ? props.initialCardId
  : props.cards.find((item) => item.isDefault && !item.isFrozen)?.id ?? ''

const form = reactive({
  amount: '',
  categoryId: defaultCategory,
  debitCardId: defaultCard,
  description: '',
  showDetails: false,
})

const quickCategories = computed(() => {
  const ids = [...(props.recentCategoryIds ?? []), ...props.categories.map((item) => item.id)]
  return [...new Set(ids)].map((id) => props.categories.find((item) => item.id === id)).filter(Boolean).slice(0, 5) as Category[]
})

const selectableCards = computed(() => props.cards.filter((card) => !card.isFrozen))

onMounted(async () => {
  await nextTick()
  amountInput.value?.focus()
})

function setAmount(value: string) {
  form.amount = value
  amountInput.value?.focus()
}

function submit() {
  const amount = form.amount.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || !form.categoryId) return
  const category = props.categories.find((item) => item.id === form.categoryId)

  emit('save', {
    kind: 'expense',
    amount,
    date: new Date().toISOString().slice(0, 10),
    categoryId: form.categoryId,
    debitCardId: form.debitCardId || null,
    description: form.description.trim() || category?.name || 'Compra rápida',
    recurrence: 'variable',
  })
}
</script>

<template>
  <div class="fixed inset-0 z-[70] flex items-end bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <form class="w-full rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[2rem] sm:p-5" @submit.prevent="submit">
      <div class="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden"></div>
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 text-emerald-600"><Zap :size="16" fill="currentColor" /><span class="text-xs font-black uppercase tracking-[0.16em]">Gasto rápido</span></div>
          <h2 class="mt-1 text-xl font-black">Quanto você gastou?</h2>
        </div>
        <button type="button" class="grid size-10 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button>
      </div>

      <div class="mt-5 rounded-[1.5rem] bg-slate-100 p-4 dark:bg-slate-950">
        <div class="flex items-center gap-2 text-slate-400"><span class="text-xl font-black">R$</span>
          <input ref="amountInput" v-model="form.amount" inputmode="decimal" autocomplete="off" placeholder="0,00" class="min-w-0 flex-1 bg-transparent text-4xl font-black tracking-tight placeholder:text-slate-300 dark:placeholder:text-slate-700" />
        </div>
        <div class="mt-3 grid grid-cols-4 gap-2">
          <button v-for="value in ['5,00','10,00','20,00','50,00']" :key="value" type="button" class="rounded-xl bg-white py-2 text-xs font-black shadow-sm dark:bg-slate-800" @click="setAmount(value)">R$ {{ value.replace(',00','') }}</button>
        </div>
      </div>

      <div class="mt-5">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Categoria</p>
        <div class="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button v-for="category in quickCategories" :key="category.id" type="button" class="shrink-0 rounded-2xl border px-3.5 py-2.5 text-sm font-bold transition" :class="form.categoryId === category.id ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 dark:border-slate-700'" @click="form.categoryId = category.id">
            {{ category.name }}
          </button>
        </div>
      </div>

      <div class="mt-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Como pagou?</p>
        <div class="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button type="button" class="flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-bold" :class="!form.debitCardId ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'" @click="form.debitCardId = ''"><Banknote :size="17" /> PIX / saldo</button>
          <button v-for="card in selectableCards" :key="card.id" type="button" class="flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-bold" :class="form.debitCardId === card.id ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700'" @click="form.debitCardId = card.id"><CreditCard :size="17" /> {{ card.emoji || '' }} {{ card.name }} · {{ card.lastFour }}</button>
        </div>
      </div>

      <button type="button" class="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-slate-700" @click="form.showDetails = !form.showDetails">
        <span>{{ form.description ? form.description : 'Adicionar descrição (opcional)' }}</span><ChevronDown :size="17" :class="form.showDetails ? 'rotate-180' : ''" />
      </button>
      <input v-if="form.showDetails" v-model="form.description" maxlength="160" placeholder="Ex.: doce na saída da escola" class="mt-2 w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm dark:border-slate-700" />

      <button class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-4 text-base font-black text-slate-950 active:scale-[0.99]">
        <Check :size="20" stroke-width="3" /> Registrar gasto
      </button>
    </form>
  </div>
</template>
