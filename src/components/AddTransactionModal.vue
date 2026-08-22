<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BellRing, CalendarClock, PiggyBank, Plus, ReceiptText, Sparkles, Trash2, X } from 'lucide-vue-next'
import { useFinanceStore } from '../stores/financeStore'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import { localDateKey } from '../services/recurringDates'
import { useKeyboardAwareModal } from '../services/mobileViewport'
import type {
  Category,
  DebitCard,
  NewRecurringRuleInput,
  NewTransactionInput,
  TransactionType,
  RecurrenceType,
  Transaction,
  Vault,
} from '../types/finance'

const props = withDefaults(defineProps<{
  categories: Category[]
  cards: DebitCard[]
  vaults?: Vault[]
  transaction?: Transaction | null
  initialKind?: TransactionType
  initialFlow?: 'transaction' | 'recurring' | 'vault'
}>(), { vaults: () => [], initialKind: 'expense', initialFlow: 'transaction' })
const store = useFinanceStore()
const { overlayStyle, contentStyle, keepFocusedFieldVisible } = useKeyboardAwareModal()
const emit = defineEmits<{
  close: []
  save: [input: NewTransactionInput]
  saveRecurring: [input: NewRecurringRuleInput]
  sendToVault: [input: { vaultId: string; amount: string }]
  delete: [transaction: Transaction]
}>()

const initialKind = (props.transaction?.kind ?? props.initialKind) as TransactionType
const defaultCardId = initialKind === 'expense'
  ? props.cards.find((card) => card.isDefault && !card.isFrozen)?.id ?? ''
  : ''
const defaultCategoryId = props.categories.find((category) => category.kind === initialKind)?.id ?? ''

const now = new Date()
const form = reactive({
  flow: props.initialFlow as 'transaction' | 'recurring' | 'vault',
  kind: initialKind,
  amount: props.transaction ? storageDecimalToLocalized(props.transaction.amount) : '',
  date: props.transaction?.date ?? localDateKey(new Date()),
  time: props.transaction?.occurredAt?.slice(11, 16)
    ?? `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
  categoryId: props.transaction?.categoryId ?? defaultCategoryId,
  debitCardId: props.transaction?.debitCardId ?? defaultCardId,
  description: props.transaction?.description ?? '',
  recurrence: (props.transaction?.recurrence ?? 'variable') as RecurrenceType,
  dayOfMonth: 0,
  reminderEnabled: true,
  vaultId: props.vaults[0]?.id ?? '',
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
  if (!props.transaction && form.flow === 'vault') {
    if (!form.vaultId) { formError.value = 'Crie ou escolha um Porquinho para receber o valor.'; return }
    emit('sendToVault', { vaultId: form.vaultId, amount })
    return
  }
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
    occurredAt: form.time ? `${form.date}T${form.time}:00` : null,
    categoryId: form.categoryId || null,
    debitCardId: form.kind === 'expense' ? form.debitCardId || null : null,
    description: form.description.trim(),
    recurrence: form.recurrence,
  })
}
</script>

<template>
  <div class="keyboard-aware-modal fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 sm:place-items-center sm:p-4" :style="overlayStyle" @click.self="emit('close')" @focusin="keepFocusedFieldVisible">
    <form class="w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-3xl sm:pb-5" :style="contentStyle" @submit.prevent="submit">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-emerald-600">{{ transaction ? 'Correção do histórico' : 'Nova movimentação' }}</p>
          <h2 class="text-xl font-black">{{ transaction ? 'Editar transação' : 'Adicionar transação' }}</h2>
        </div>
        <button type="button" class="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div v-if="form.flow !== 'vault'" class="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        <button type="button" class="rounded-xl px-3 py-2 text-sm font-bold" :class="form.kind === 'expense' ? 'bg-white shadow-sm dark:bg-slate-700' : ''" @click="form.kind = 'expense'">Despesa</button>
        <button type="button" class="rounded-xl px-3 py-2 text-sm font-bold" :class="form.kind === 'income' ? 'bg-white shadow-sm dark:bg-slate-700' : ''" @click="form.kind = 'income'">Entrada</button>
      </div>

      <section v-if="!transaction" class="mt-4">
        <p class="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Como o Pingo deve cuidar disso?</p>
        <div class="grid grid-cols-3 gap-2">
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
          <button type="button" class="rounded-2xl border p-3 text-left transition" :class="form.flow === 'vault' ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100' : 'border-slate-200 dark:border-slate-700'" @click="form.flow = 'vault'">
            <PiggyBank :size="19" />
            <strong class="mt-2 block text-sm">Porquinho</strong>
            <span class="mt-0.5 block text-[11px] text-slate-500">Protege uma parte do saldo</span>
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
        <label v-if="form.flow === 'transaction' || transaction" class="grid gap-1.5 text-sm font-semibold">
          Hora
          <input v-model="form.time" type="time" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label v-if="form.flow !== 'vault'" class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Descrição
          <input v-model="form.description" maxlength="160" :placeholder="descriptionPlaceholder" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <div v-if="form.flow !== 'vault'" class="grid gap-1.5 text-sm font-semibold">
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
        <label v-else-if="form.flow === 'recurring'" class="grid gap-1.5 text-sm font-semibold">
          Dia do mês
          <select v-model.number="form.dayOfMonth" class="rounded-xl border border-violet-200 bg-transparent px-3 py-2.5 dark:border-violet-800">
            <option :value="0" disabled>Escolha o vencimento</option>
            <option v-for="day in dayOptions" :key="day" :value="day">Dia {{ day }}</option>
          </select>
        </label>
        <label v-if="form.kind === 'expense' && form.flow !== 'vault'" class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Meio de pagamento
          <select v-model="form.debitCardId" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="">Saldo / PIX / dinheiro</option>
            <option v-for="card in props.cards" :key="card.id" :value="card.id" :disabled="card.isFrozen">
              {{ card.name }} · {{ card.issuer }} · •••• {{ card.lastFour }}{{ card.isFrozen ? ' (congelado)' : '' }}
            </option>
          </select>
          <span class="text-xs font-normal text-slate-500">O cartão apenas identifica a compra; o valor sai do mesmo saldo da conta.</span>
        </label>
        <label v-if="!transaction && form.flow === 'vault'" class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Porquinho de destino
          <select v-model="form.vaultId" class="rounded-xl border border-amber-200 bg-transparent px-3 py-2.5 dark:border-amber-800">
            <option value="" disabled>{{ vaults.length ? 'Escolha o Porquinho' : 'Nenhum Porquinho criado' }}</option>
            <option v-for="vault in vaults" :key="vault.id" :value="vault.id">{{ vault.emoji ?? '🐷' }} {{ vault.name }} · {{ vault.institution }}</option>
          </select>
          <span class="text-xs font-normal text-slate-500">O valor sai do saldo disponível e entra na reserva na mesma operação. Seu patrimônio total não muda.</span>
        </label>
        <div v-if="showNewCategory && form.flow !== 'vault'" class="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30 sm:col-span-2">
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
      <div class="mt-6 grid gap-2" :class="transaction ? 'grid-cols-[auto_1fr]' : ''">
        <button v-if="transaction" type="button" class="grid size-12 place-items-center rounded-2xl border border-rose-200 text-rose-600 dark:border-rose-900" :aria-label="`Excluir ${transaction.description}`" @click="emit('delete', transaction)"><Trash2 :size="18" /></button>
        <button class="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400">
          {{ transaction ? 'Salvar alterações' : form.flow === 'recurring' ? 'Ligar Piloto Mensal' : form.flow === 'vault' ? 'Enviar para o Porquinho' : 'Salvar transação' }}
        </button>
      </div>
    </form>
  </div>
</template>
