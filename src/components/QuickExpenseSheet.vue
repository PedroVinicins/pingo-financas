<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Banknote, Check, ChevronDown, CreditCard, Plus, X, Zap } from 'lucide-vue-next'
import type { Category, DebitCard, NewTransactionInput } from '../types/finance'
import { useFinanceStore } from '../stores/financeStore'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import { localDateKey } from '../services/recurringDates'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import { useKeyboardAwareModal } from '../services/mobileViewport'

const props = defineProps<{
  categories: Category[]
  cards: DebitCard[]
  recentCategoryIds?: string[]
  initialCardId?: string
}>()

const emit = defineEmits<{ close: []; save: [input: NewTransactionInput] }>()
const store = useFinanceStore()
const { overlayStyle, contentStyle, keepFocusedFieldVisible } = useKeyboardAwareModal()
const amountInput = ref<InstanceType<typeof LocalizedNumberInput> | null>(null)
const expenseCategories = computed(() => props.categories.filter((item) => item.kind === 'expense'))
const defaultCategory = props.recentCategoryIds?.[0]
  ?? props.categories.find((item) => item.kind === 'expense' && item.name.toLowerCase().includes('alimenta'))?.id
  ?? props.categories.find((item) => item.kind === 'expense')?.id
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
const showNewCategory = ref(false)
const categoryError = ref('')
const formError = ref('')
const categoryDraft = reactive({ name: '', color: '#10B981' })

const quickCategories = computed(() => {
  const ids = [...(props.recentCategoryIds ?? []), ...expenseCategories.value.map((item) => item.id)]
  return [...new Set(ids)]
    .map((id) => expenseCategories.value.find((item) => item.id === id))
    .filter(Boolean)
    .slice(0, 5) as Category[]
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
  formError.value = ''
  let amount: string
  try {
    amount = localizedDecimalToStorage(form.amount)
  } catch {
    formError.value = 'Digite um valor válido.'
    return
  }
  if (Number(amount) <= 0) { formError.value = 'O valor precisa ser maior que zero.'; return }
  if (!form.categoryId) { formError.value = 'Escolha uma categoria.'; return }
  const category = props.categories.find((item) => item.id === form.categoryId)

  emit('save', {
    kind: 'expense',
    amount,
    date: localDateKey(new Date()),
    categoryId: form.categoryId,
    debitCardId: form.debitCardId || null,
    description: form.description.trim() || category?.name || 'Compra rápida',
    recurrence: 'variable',
  })
}

async function createCategory() {
  categoryError.value = ''
  try {
    const category = await store.createCategory({
      kind: 'expense',
      name: categoryDraft.name,
      icon: 'tag',
      color: categoryDraft.color,
    })
    form.categoryId = category.id
    categoryDraft.name = ''
    showNewCategory.value = false
  } catch (error) {
    categoryError.value = error instanceof Error ? error.message : 'Não foi possível criar a categoria'
  }
}
</script>

<template>
  <div class="keyboard-aware-modal fixed inset-0 z-[70] flex items-end bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" :style="overlayStyle" @click.self="emit('close')" @focusin="keepFocusedFieldVisible">
    <form class="w-full overflow-y-auto overscroll-contain rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[2rem] sm:p-5" :style="contentStyle" @submit.prevent="submit">
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
          <LocalizedNumberInput ref="amountInput" v-model="form.amount" placeholder="0,00" class="min-w-0 flex-1 bg-transparent text-4xl font-black tracking-tight placeholder:text-slate-300 dark:placeholder:text-slate-700" />
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
          <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-dashed border-emerald-400 px-3.5 py-2.5 text-sm font-black text-emerald-600" @click="showNewCategory = !showNewCategory"><Plus :size="16" /> Nova</button>
        </div>
        <div v-if="showNewCategory" class="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 rounded-2xl bg-emerald-50 p-2 dark:bg-emerald-950/30">
          <input v-model="categoryDraft.name" maxlength="40" placeholder="Ex.: Academia" class="min-w-0 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm dark:border-emerald-900 dark:bg-slate-900" @keyup.enter.prevent="createCategory" />
          <input v-model="categoryDraft.color" type="color" class="h-10 w-11 rounded-xl border border-emerald-200 bg-white p-1 dark:border-emerald-900 dark:bg-slate-900" aria-label="Cor da categoria" />
          <button type="button" class="rounded-xl bg-emerald-500 px-3 text-sm font-black text-white" aria-label="Salvar categoria" @click="createCategory"><Check :size="18" /></button>
          <p v-if="categoryError" class="col-span-3 px-1 text-xs font-bold text-rose-600">{{ categoryError }}</p>
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

      <p v-if="formError" class="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/35 dark:text-rose-300" role="alert">{{ formError }}</p>

      <button class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-4 text-base font-black text-slate-950 active:scale-[0.99]">
        <Check :size="20" stroke-width="3" /> Registrar gasto
      </button>
    </form>
  </div>
</template>
