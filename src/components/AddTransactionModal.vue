<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BellRing, CalendarClock, PiggyBank, Plus, ReceiptText, Sparkles, Trash2, X } from 'lucide-vue-next'
import { useFinanceStore } from '../stores/financeStore'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import CategoryIcon from './CategoryIcon.vue'
import AppModal from './AppModal.vue'
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
const categoryDraft = reactive({ name: '', color: '#10B981', icon: initialKind === 'income' ? 'hand-coins' : 'tag' })
const expenseIconOptions = [
  ['tag', 'Geral'], ['utensils', 'Alimentação'], ['house', 'Casa'], ['car', 'Carro'],
  ['shopping-cart', 'Mercado'], ['shirt', 'Roupas'], ['paw-print', 'Pets'], ['dumbbell', 'Academia'],
  ['plane', 'Viagem'], ['smartphone', 'Celular'], ['heart-pulse', 'Saúde'], ['graduation-cap', 'Estudos'],
] as const
const incomeIconOptions = [
  ['hand-coins', 'Pagamento'], ['badge-dollar-sign', 'Salário'], ['briefcase-business', 'Trabalho'],
  ['store', 'Vendas'], ['trending-up', 'Investimento'], ['gift', 'Presente'],
  ['landmark', 'Banco'], ['wallet-cards', 'Reembolso'], ['piggy-bank', 'Reserva'],
] as const
const categoryIconOptions = computed(() => form.kind === 'income' ? incomeIconOptions : expenseIconOptions)
const filteredCategories = computed(() => props.categories.filter((category) => category.kind === form.kind))
const selectedCategory = computed(() => filteredCategories.value.find((category) => category.id === form.categoryId) ?? null)
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
  categoryDraft.icon = kind === 'income' ? 'hand-coins' : 'tag'
})

async function createCategory() {
  categoryError.value = ''
  try {
    const category = await store.createCategory({
      kind: form.kind,
      name: categoryDraft.name,
      icon: categoryDraft.icon,
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
  <AppModal as="form" aria-labelledby="transaction-modal-title" root-class="keyboard-aware-modal z-50" panel-class="p-5 sm:max-w-[560px] sm:p-6" :root-style="overlayStyle" :panel-style="contentStyle" @close="emit('close')" @submit="submit" @focusin="keepFocusedFieldVisible">
      <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden"></div>
      <div class="mb-6 flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-subtle">
            {{ transaction ? 'Edição do histórico' : 'Registro rápido' }}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-subtle"><i class="block size-1.5 rounded-full bg-emerald-500"></i> protegido</span>
          </p>
          <h2 id="transaction-modal-title" class="mt-1 break-words text-2xl font-extrabold tracking-tight">{{ transaction ? 'Editar transação' : form.flow === 'vault' ? 'Nova transferência' : form.kind === 'income' ? 'Nova entrada' : 'Novo gasto' }}</h2>
          <p class="mt-1 text-sm text-subtle">Adicione uma movimentação em poucos segundos.</p>
        </div>
        <button type="button" class="pingo-modal-close" aria-label="Fechar formulário" @click="emit('close')">
          <X :size="21" />
        </button>
      </div>

      <div v-if="form.flow !== 'vault'" class="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        <button type="button" class="min-h-11 rounded-xl px-3 text-[13px] font-bold text-subtle" :class="form.kind === 'expense' ? 'bg-surface text-brand shadow-sm' : ''" @click="form.kind = 'expense'">Gasto</button>
        <button type="button" class="min-h-11 rounded-xl px-3 text-[13px] font-bold text-subtle" :class="form.kind === 'income' ? 'bg-surface text-brand shadow-sm' : ''" @click="form.kind = 'income'">Entrada</button>
      </div>

      <section v-if="!transaction" class="mt-5">
        <p class="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">Como o Pingo deve cuidar disso?</p>
        <div class="grid grid-cols-3 gap-2">
          <button type="button" class="rounded-2xl border p-3 text-left transition" :class="form.flow === 'transaction' ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface'" @click="form.flow = 'transaction'">
            <ReceiptText :size="19" />
            <strong class="mt-2 block text-sm">Só desta vez</strong>
            <span class="mt-0.5 block text-[11px] text-subtle">Altera o saldo agora</span>
          </button>
          <button type="button" class="relative overflow-hidden rounded-2xl border p-3 text-left transition" :class="form.flow === 'recurring' ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface'" @click="form.flow = 'recurring'">
            <Sparkles class="absolute right-2 top-2 text-brand" :size="15" />
            <CalendarClock :size="19" />
            <strong class="mt-2 block text-sm">Piloto mensal</strong>
            <span class="mt-0.5 block text-[11px] text-subtle">O Pingo lembra todo mês</span>
          </button>
          <button type="button" class="rounded-2xl border p-3 text-left transition" :class="form.flow === 'vault' ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface'" @click="form.flow = 'vault'">
            <PiggyBank :size="19" />
            <strong class="mt-2 block text-sm">Porquinho</strong>
            <span class="mt-0.5 block text-[11px] text-subtle">Protege uma parte do saldo</span>
          </button>
        </div>
      </section>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-2 text-[13px] font-bold text-brand sm:col-span-2">
          Valor
          <LocalizedNumberInput v-model="form.amount" placeholder="0,00" class="min-h-[68px] rounded-2xl border border-line bg-surface px-4 text-[30px] font-extrabold tracking-[-.04em] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft" />
        </label>
        <label v-if="form.flow === 'transaction' || transaction" class="grid gap-2 text-[13px] font-bold">
          Data
          <input v-model="form.date" type="date" class="min-h-[52px] rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft" />
        </label>
        <label v-if="form.flow === 'transaction' || transaction" class="grid gap-2 text-[13px] font-bold">
          Hora
          <input v-model="form.time" type="time" class="min-h-[52px] min-w-0 rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft" />
        </label>
        <label v-if="form.flow !== 'vault'" class="grid gap-2 text-[13px] font-bold sm:col-span-2">
          Descrição
          <input v-model="form.description" maxlength="160" :placeholder="descriptionPlaceholder" class="min-h-[52px] rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft" />
        </label>
        <div v-if="form.flow !== 'vault'" class="grid gap-2 text-[13px] font-bold">
          <div class="flex items-center justify-between gap-2">
            <span>Categoria de {{ form.kind === 'income' ? 'entrada' : 'despesa' }}</span>
            <button type="button" class="inline-flex items-center gap-1 text-xs font-extrabold text-brand" @click="showNewCategory = !showNewCategory">
              <Plus :size="14" /> Nova
            </button>
          </div>
          <div class="flex min-w-0 items-center gap-2">
            <CategoryIcon :category="selectedCategory" :kind="form.kind" :size="18" />
            <select v-model="form.categoryId" class="min-h-[52px] min-w-0 flex-1 rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft">
              <option value="" disabled>Selecione</option>
              <option v-for="category in filteredCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
          </div>
        </div>
        <label v-if="form.flow === 'transaction' || transaction" class="grid gap-2 text-[13px] font-bold">
          Natureza
          <select v-model="form.recurrence" class="min-h-[52px] rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft">
            <option value="variable">Variável</option>
            <option value="fixed">Fixa</option>
          </select>
        </label>
        <label v-else-if="form.flow === 'recurring'" class="grid gap-2 text-[13px] font-bold">
          Dia do mês
          <select v-model.number="form.dayOfMonth" class="min-h-[52px] rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft">
            <option :value="0" disabled>Escolha o vencimento</option>
            <option v-for="day in dayOptions" :key="day" :value="day">Dia {{ day }}</option>
          </select>
        </label>
        <label v-if="form.kind === 'expense' && form.flow !== 'vault'" class="grid gap-2 text-[13px] font-bold sm:col-span-2">
          Meio de pagamento
          <select v-model="form.debitCardId" class="min-h-[52px] rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft">
            <option value="">Saldo / PIX / dinheiro</option>
            <option v-for="card in props.cards" :key="card.id" :value="card.id" :disabled="card.isFrozen">
              {{ card.name }} · {{ card.issuer }} · •••• {{ card.lastFour }}{{ card.isFrozen ? ' (congelado)' : '' }}
            </option>
          </select>
          <span class="text-xs font-normal text-subtle">O cartão apenas identifica a compra; o valor sai do mesmo saldo da conta.</span>
        </label>
        <label v-if="!transaction && form.flow === 'vault'" class="grid gap-2 text-[13px] font-bold sm:col-span-2">
          Porquinho de destino
          <select v-model="form.vaultId" class="min-h-[52px] rounded-2xl border border-line bg-muted px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft">
            <option value="" disabled>{{ vaults.length ? 'Escolha o Porquinho' : 'Nenhum Porquinho criado' }}</option>
            <option v-for="vault in vaults" :key="vault.id" :value="vault.id">{{ vault.emoji ?? '🐷' }} {{ vault.name }} · {{ vault.institution }}</option>
          </select>
          <span class="text-xs font-normal text-subtle">O valor sai do saldo disponível e entra na reserva na mesma operação. Seu patrimônio total não muda.</span>
        </label>
        <div v-if="showNewCategory && form.flow !== 'vault'" class="grid gap-3 rounded-2xl border border-brand/25 bg-brand-soft p-4 sm:col-span-2">
          <div>
            <p class="font-extrabold">Nova categoria de {{ form.kind === 'income' ? 'entrada' : 'despesa' }}</p>
            <p class="text-xs font-normal text-subtle">Ela ficará disponível nos próximos lançamentos.</p>
          </div>
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <input v-model="categoryDraft.name" maxlength="40" :placeholder="form.kind === 'income' ? 'Ex.: Comissão' : 'Ex.: Academia'" class="min-h-11 min-w-0 rounded-xl border border-brand/25 bg-surface px-3 outline-none focus:border-brand" @keyup.enter.prevent="createCategory" />
            <input v-model="categoryDraft.color" type="color" class="h-11 w-12 rounded-xl border border-brand/25 bg-surface p-1" aria-label="Cor da categoria" />
          </div>
          <div>
            <p class="mb-2 text-xs font-extrabold uppercase tracking-wide text-subtle">Escolha um ícone</p>
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" :aria-label="`Ícone da categoria de ${form.kind === 'income' ? 'entrada' : 'gasto'}`">
              <button v-for="option in categoryIconOptions" :key="option[0]" type="button" class="btn h-auto min-h-14 rounded-xl border p-1" :class="categoryDraft.icon === option[0] ? 'border-brand bg-surface ring-2 ring-brand/20' : 'border-transparent bg-surface/70'" role="radio" :aria-checked="categoryDraft.icon === option[0]" :aria-label="option[1]" @click="categoryDraft.icon = option[0]">
                <CategoryIcon :category="{ name: option[1], icon: option[0], color: categoryDraft.color }" :kind="form.kind" :size="18" />
              </button>
            </div>
          </div>
          <p v-if="categoryError" class="text-xs font-bold text-rose-600">{{ categoryError }}</p>
          <button type="button" class="btn min-h-11 rounded-xl border-0 bg-brand px-3 text-sm font-extrabold text-white" @click="createCategory">Adicionar categoria</button>
        </div>
        <label v-if="!transaction && form.flow === 'recurring'" class="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand/25 bg-brand-soft p-4 sm:col-span-2">
          <input v-model="form.reminderEnabled" type="checkbox" class="mt-1 size-4 accent-violet-600" />
          <BellRing :size="20" class="shrink-0 text-brand" />
          <span><strong class="block text-sm">{{ form.kind === 'expense' ? 'Se pinga, me lembre de pagar!' : 'Me avise quando o salário estiver previsto' }}</strong><span class="mt-1 block text-xs font-normal text-subtle">A confirmação só aparece no vencimento. Contas não respondidas entram após três dias e somente se houver saldo.</span></span>
        </label>
      </div>

      <div v-if="!transaction && form.flow === 'recurring'" class="mt-4 rounded-2xl bg-hero p-4 text-white">
        <div class="flex items-start gap-3"><div class="grid size-9 shrink-0 place-items-center rounded-xl bg-brand font-black text-white">P</div><p class="text-sm font-semibold leading-relaxed">Relaxa: eu anoto a data, mas não encosto no seu saldo antes da hora. Porquinho responsável tem limites. 😌</p></div>
      </div>
      <p v-if="formError" class="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/35 dark:text-rose-300">{{ formError }}</p>
      <div class="pingo-modal-footer mt-6 grid gap-2" :class="transaction ? 'grid-cols-[auto_1fr]' : ''">
        <button v-if="transaction" type="button" class="btn btn-square h-14 min-h-14 w-14 rounded-2xl border-rose-200 bg-surface text-rose-600 dark:border-rose-900" :aria-label="`Excluir ${transaction.description}`" @click="emit('delete', transaction)"><Trash2 :size="18" /></button>
        <button class="btn min-h-14 w-full rounded-full border-0 bg-brand px-5 font-extrabold text-white shadow-[0_10px_24px_rgba(124,58,237,.18)] hover:bg-hero">
          {{ transaction ? 'Salvar alterações' : form.flow === 'recurring' ? 'Ligar Piloto Mensal' : form.flow === 'vault' ? 'Enviar para o Porquinho' : 'Salvar transação' }}
        </button>
      </div>
  </AppModal>
</template>
