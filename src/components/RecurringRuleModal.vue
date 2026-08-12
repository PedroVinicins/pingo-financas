<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BellRing, CalendarClock, X } from 'lucide-vue-next'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import type { Category, DebitCard, NewRecurringRuleInput, TransactionType } from '../types/finance'

const props = defineProps<{ categories: Category[]; cards: DebitCard[] }>()
const emit = defineEmits<{ close: []; save: [input: NewRecurringRuleInput] }>()
const error = ref('')
const form = reactive({
  kind: 'expense' as TransactionType,
  amount: '',
  dayOfMonth: 0,
  categoryId: props.categories.find((item) => item.kind === 'expense')?.id ?? '',
  debitCardId: '',
  description: '',
  reminderEnabled: true,
})
const filteredCategories = computed(() => props.categories.filter((item) => item.kind === form.kind))
const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1)
const reminderLabel = computed(() => form.kind === 'expense'
  ? 'Se pinga, me lembre de pagar!'
  : 'Me avise: “Opa, já pingou seu salário?”')

watch(() => form.kind, (kind) => {
  form.categoryId = props.categories.find((item) => item.kind === kind)?.id ?? ''
  if (kind === 'income') form.debitCardId = ''
})

function submit() {
  error.value = ''
  let amount: string
  try { amount = localizedDecimalToStorage(form.amount) } catch { error.value = 'Informe um valor válido.'; return }
  if (Number(amount) <= 0 || !form.description.trim() || !form.categoryId || form.dayOfMonth < 1) {
    error.value = 'Preencha valor, dia do mês, descrição e categoria.'
    return
  }
  emit('save', {
    kind: form.kind,
    amount,
    dayOfMonth: Number(form.dayOfMonth),
    categoryId: form.categoryId,
    debitCardId: form.kind === 'expense' ? form.debitCardId || null : null,
    description: form.description.trim(),
    reminderEnabled: form.reminderEnabled,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-[80] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <form class="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between gap-3"><div class="flex gap-3"><div class="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950"><CalendarClock :size="21" /></div><div><p class="text-sm font-bold text-violet-600">Todo mês</p><h2 class="text-xl font-black">Nova renda ou conta fixa</h2></div></div><button type="button" class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button></div>

      <div class="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800"><button type="button" class="rounded-xl px-3 py-2.5 text-sm font-black" :class="form.kind === 'expense' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'" @click="form.kind = 'expense'">Conta / assinatura</button><button type="button" class="rounded-xl px-3 py-2.5 text-sm font-black" :class="form.kind === 'income' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'" @click="form.kind = 'income'">Salário / renda</button></div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Nome<input v-model="form.description" maxlength="160" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" :placeholder="form.kind === 'income' ? 'Ex.: Salário da Saga' : 'Ex.: Netflix ou recarga do celular'" /></label>
        <label class="grid gap-1.5 text-sm font-bold">Valor<LocalizedNumberInput v-model="form.amount" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="0,00" /></label>
        <label class="grid gap-1.5 text-sm font-bold">Dia do mês<select v-model.number="form.dayOfMonth" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700"><option :value="0" disabled>Escolha o dia</option><option v-for="day in dayOptions" :key="day" :value="day">Dia {{ day }}</option></select></label>
        <label class="grid gap-1.5 text-sm font-bold">Categoria<select v-model="form.categoryId" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700"><option value="" disabled>Selecione</option><option v-for="category in filteredCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
        <label v-if="form.kind === 'expense'" class="grid gap-1.5 text-sm font-bold">Meio de pagamento<select v-model="form.debitCardId" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700"><option value="">Saldo / PIX</option><option v-for="card in cards" :key="card.id" :value="card.id" :disabled="card.isFrozen">{{ card.name }} •••• {{ card.lastFour }}</option></select></label>
      </div>

      <label class="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30"><input v-model="form.reminderEnabled" type="checkbox" class="mt-1 size-4 accent-violet-600" /><BellRing :size="20" class="shrink-0 text-violet-600" /><span><strong class="block text-sm">{{ reminderLabel }}</strong><span class="mt-1 block text-xs text-slate-500">A confirmação só aparece no dia escolhido ou depois dele. Os 3 dias começam a contar somente após o vencimento.</span></span></label>
      <p v-if="error" class="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40">{{ error }}</p>
      <button class="mt-5 w-full rounded-2xl bg-violet-500 py-3.5 font-black text-white">Criar recorrência mensal</button>
    </form>
  </div>
</template>
