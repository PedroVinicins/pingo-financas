<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BellRing, CalendarClock, Plus, ReceiptText, Sparkles, X } from 'lucide-vue-next'
import { useFinanceStore } from '../stores/financeStore'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import type {
  Category,
  DebitCard,
  NewRecurringRuleInput,
  NewTransactionInput,
  TransactionType,
  RecurrenceType,
  Transaction,
} from '../types/finance'

const props = defineProps<{ categories: Category[]; cards: DebitCard[]; transaction?: Transaction | null }>()
const store = useFinanceStore()
const emit = defineEmits<{
  close: []
  save: [input: NewTransactionInput]
  saveRecurring: [input: NewRecurringRuleInput]
}>()

const defaultCardId = props.cards.find((card) => card.isDefault && !card.isFrozen)?.id ?? ''
const defaultExpenseCategoryId = props.categories.find((category) => category.kind === 'expense')?.id ?? ''

const form = reactive({
  flow: 'transaction' as 'transaction' | 'recurring',
  kind: (props.transaction?.kind ?? 'expense') as TransactionType,
  amount: props.transaction ? storageDecimalToLocalized(props.transaction.amount) : '',
  date: props.transaction?.date ?? new Date().toISOString().slice(0, 10),
  categoryId: props.transaction?.categoryId ?? defaultExpenseCategoryId,
  debitCardId: props.transaction?.debitCardId ?? defaultCardId,
  description: props.transaction?.description ?? '',
  recurrence: (props.transaction?.recurrence ?? 'variable') as RecurrenceType,
  dayOfMonth: 0,
  reminderEnabled: true,
})

const showNewCategory = ref(false)
const categoryError = ref('')
const formError = ref('')
const categoryDraft = reactive({ name: '', color: '#10B981' })
const filteredCategories = computed(() => props.categories.filter((category) => category.kind === form.kind))
const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1)
const descriptionPlaceholder = computed(() => {
  if (form.flow === 'recurring') return form.kind === 'income' ? 'Ex.: Salário da Saga' : 'Ex.: Internet ou Netflix'
  return form.kind === 'income' ? 'Ex.: Salário de agosto' : 'Ex.: Mercado'
})

watch(() => form.kind, (kind) => {
  if (kind === 'income') form.debitCardId = ''
  form.categoryId = props.categories.find((category) => category.kind === kind)?.id ?? ''
  showNewCategory.value = false
  categoryError.value = ''
})

async function createCategory() {
  categoryError.value = ''
  try {
    const category = await store.createCategory({
      kind: form.kind,
      name: categoryDraft.name,
      icon: form.kind === 'income' ? 'circle-dollar-sign' : 'tag',
      color: categoryDraft.color,
    })
    form.categoryId = category.id
    categoryDraft.name = ''
    showNewCategory.value = false
  } catch (error) {
    categoryError.value = error instanceof Error ? error.message : 'Não foi possível criar a categoria'
  }
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
  if (!form.description.trim()) { formError.value = 'Dê um nome para esta movimentação.'; return }
  if (!form.categoryId) { formError.value = 'Escolha uma categoria.'; return }

  const selectedCard = props.cards.find((card) => card.id === form.debitCardId)
  if (selectedCard?.isFrozen) { formError.value = 'Esse cartão está congelado.'; return }

  if (!props.transaction && form.flow === 'recurring') {
    if (form.dayOfMonth < 1) { formError.value = 'Escolha o dia do mês.'; return }
    emit('saveRecurring', {
      kind: form.kind,
      amount,
      dayOfMonth: form.dayOfMonth,
      categoryId: form.categoryId,
      debitCardId: form.kind === 'expense' ? form.debitCardId || null : null,
      description: form.description.trim(),
      reminderEnabled: form.reminderEnabled,
    })
    return
  }

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
          <p class="text-sm font-medium text-emerald-600">{{ transaction ? 'Correção do histórico' : 'Nova movimentação' }}</p>
          <h2 class="text-xl font-black">{{ transaction ? 'Editar transação' : 'Adicionar transação' }}</h2>
        </div>
        <button type="button" class="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        <button type="button" class="rounded-xl px-3 py-2 text-sm font-bold" :class="form.kind === 'expense' ? 'bg-white shadow-sm dark:bg-slate-700' : ''" @click="form.kind = 'expense'">Despesa</button>
        <button type="button" class="rounded-xl px-3 py-2 text-sm font-bold" :class="form.kind === 'income' ? 'bg-white shadow-sm dark:bg-slate-700' : ''" @click="form.kind = 'income'">Entrada</button>
      </div>

      <section v-if="!transaction" class="mt-4">
        <p class="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Como o Pingo deve cuidar disso?</p>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="rounded-2xl border p-3 text-left transition" :class="form.flow === 'transaction' ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100' : 'border-slate-200 dark:border-slate-700'" @click="form.flow = 'transaction'">
            <ReceiptText :size="19" />
            <strong class="mt-2 block text-sm">Só desta vez</strong>
            <span class="mt-0.5 block text-[11px] text-slate-500">Altera o saldo agora</span>
          </button>
          <button type="button" class="relative overflow-hidden rounded-2xl border p-3 text-left transition" :class="form.flow === 'recurring' ? 'border-violet-400 bg-violet-50 text-violet-950 dark:bg-violet-950/35 dark:text-violet-100' : 'border-slate-200 dark:border-slate-700'" @click="form.flow = 'recurring'">
            <Sparkles class="absolute right-2 top-2 text-violet-400" :size="15" />
            <CalendarClock :size="19" />
            <strong class="mt-2 block text-sm">Piloto mensal</strong>
            <span class="mt-0.5 block text-[11px] text-slate-500">O Pingo lembra todo mês</span>
          </button>
        </div>
      </section>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold">
          Valor
          <LocalizedNumberInput v-model="form.amount" placeholder="0,00" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label v-if="form.flow === 'transaction' || transaction" class="grid gap-1.5 text-sm font-semibold">
          Data
          <input v-model="form.date" type="date" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Descrição
          <input v-model="form.description" maxlength="160" :placeholder="descriptionPlaceholder" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <div class="grid gap-1.5 text-sm font-semibold">
          <div class="flex items-center justify-between gap-2">
            <span>Categoria de {{ form.kind === 'income' ? 'entrada' : 'despesa' }}</span>
            <button type="button" class="inline-flex items-center gap-1 text-xs font-black text-emerald-600" @click="showNewCategory = !showNewCategory">
              <Plus :size="14" /> Nova
            </button>
          </div>
          <select v-model="form.categoryId" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="" disabled>Selecione</option>
            <option v-for="category in filteredCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select>
        </div>
        <label v-if="form.flow === 'transaction' || transaction" class="grid gap-1.5 text-sm font-semibold">
          Natureza
          <select v-model="form.recurrence" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="variable">Variável</option>
            <option value="fixed">Fixa</option>
          </select>
        </label>
        <label v-else class="grid gap-1.5 text-sm font-semibold">
          Dia do mês
          <select v-model.number="form.dayOfMonth" class="rounded-xl border border-violet-200 bg-transparent px-3 py-2.5 dark:border-violet-800">
            <option :value="0" disabled>Escolha o vencimento</option>
            <option v-for="day in dayOptions" :key="day" :value="day">Dia {{ day }}</option>
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
        <div v-if="showNewCategory" class="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30 sm:col-span-2">
          <div>
            <p class="font-black">Nova categoria de {{ form.kind === 'income' ? 'entrada' : 'despesa' }}</p>
            <p class="text-xs font-normal text-slate-500">Ela ficará disponível nos próximos lançamentos.</p>
          </div>
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <input v-model="categoryDraft.name" maxlength="40" :placeholder="form.kind === 'income' ? 'Ex.: Comissão' : 'Ex.: Academia'" class="min-w-0 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 dark:border-emerald-900 dark:bg-slate-900" @keyup.enter.prevent="createCategory" />
            <input v-model="categoryDraft.color" type="color" class="h-11 w-12 rounded-xl border border-emerald-200 bg-white p-1 dark:border-emerald-900 dark:bg-slate-900" aria-label="Cor da categoria" />
          </div>
          <p v-if="categoryError" class="text-xs font-bold text-rose-600">{{ categoryError }}</p>
          <button type="button" class="rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-black text-white" @click="createCategory">Adicionar categoria</button>
        </div>
        <label v-if="!transaction && form.flow === 'recurring'" class="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30 sm:col-span-2">
          <input v-model="form.reminderEnabled" type="checkbox" class="mt-1 size-4 accent-violet-600" />
          <BellRing :size="20" class="shrink-0 text-violet-600" />
          <span><strong class="block text-sm">{{ form.kind === 'expense' ? 'Se pinga, me lembre de pagar!' : 'Me avise quando o salário estiver previsto' }}</strong><span class="mt-1 block text-xs font-normal text-slate-500">A confirmação só aparece no vencimento. Contas não respondidas entram após três dias e somente se houver saldo.</span></span>
        </label>
      </div>

      <div v-if="!transaction && form.flow === 'recurring'" class="mt-4 rounded-2xl bg-slate-950 p-4 text-white dark:bg-violet-950">
        <div class="flex items-start gap-3"><div class="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-400 font-black text-violet-950">P</div><p class="text-sm font-semibold leading-relaxed">Relaxa: eu anoto a data, mas não encosto no seu saldo antes da hora. Porquinho responsável tem limites. 😌</p></div>
      </div>
      <p v-if="formError" class="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/35 dark:text-rose-300">{{ formError }}</p>
      <button class="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400">
        {{ transaction ? 'Salvar alterações' : form.flow === 'recurring' ? 'Ligar Piloto Mensal' : 'Salvar transação' }}
      </button>
    </form>
  </div>
</template>
