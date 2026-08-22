<script setup lang="ts">
import { ref } from 'vue'
import { BellRing, CalendarDays, CheckCircle2, CircleDollarSign, ReceiptText, Trash2 } from 'lucide-vue-next'
import { decimalToCents, useFinanceStore } from '../stores/financeStore'
import { formatCurrencyCents } from '../services/currency'
import type { RecurringRule } from '../types/finance'
import ConfirmDialog from './ConfirmDialog.vue'

const store = useFinanceStore()
const error = ref('')
const settlingId = ref('')
const removingRule = ref<RecurringRule | null>(null)
const removing = ref(false)

function money(value: bigint) {
  return formatCurrencyCents(value, store.preferences.currency)
}
function ruleMoney(rule: RecurringRule) { return money(decimalToCents(rule.amount)) }
function categoryName(rule: RecurringRule) { return store.categories.find((item) => item.id === rule.categoryId)?.name ?? 'Sem categoria' }
function dueDate(rule: RecurringRule) { return rule.nextDueDate.split('-').reverse().join('/') }
async function settle(rule: RecurringRule) {
  error.value = ''
  settlingId.value = rule.id
  try { await store.settleRecurringRule(rule.id) }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível confirmar.'
    store.reportError(cause, 'Não foi possível confirmar.')
  }
  finally { settlingId.value = '' }
}
async function confirmRemoval() {
  if (!removingRule.value) return
  removing.value = true
  try {
    await store.removeRecurringRule(removingRule.value.id)
    removingRule.value = null
    store.showFeedback('Compromisso mensal removido.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível remover a recorrência.') }
  finally { removing.value = false }
}
</script>

<template>
  <section class="mt-5 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-start justify-between gap-3 p-5 sm:p-6"><div><p class="text-sm font-bold text-violet-600">Agenda do Piloto Mensal</p><h3 class="text-xl font-black">Próximos pingos e boletos</h3><p class="mt-1 text-sm text-slate-500">Para cadastrar: Adicionar transação → Piloto mensal.</p></div><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><CalendarDays :size="21" /></div></div>

    <div class="grid grid-cols-2 gap-3 px-5 pb-5 sm:px-6"><div class="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/25"><div class="flex items-center gap-2 text-xs font-bold text-rose-600"><ReceiptText :size="15" /> Contas por mês</div><p class="mt-2 text-xl font-black">{{ money(store.fixedMonthlyCommitmentCents) }}</p></div><div class="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/25"><div class="flex items-center gap-2 text-xs font-bold text-emerald-600"><CircleDollarSign :size="15" /> Rendas previstas</div><p class="mt-2 text-xl font-black">{{ money(store.expectedMonthlyIncomeCents) }}</p></div></div>

    <div v-if="store.dueRecurringRules.length" class="border-y border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900 dark:bg-amber-950/20 sm:p-6"><div class="mb-3 flex items-center gap-2 text-sm font-black text-amber-700 dark:text-amber-300"><BellRing :size="18" /> Precisa da sua confirmação</div><div class="grid gap-3"><article v-for="rule in store.dueRecurringRules" :key="rule.id" class="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate font-black">{{ rule.description }}</p><p class="mt-1 text-xs text-slate-500">Dia {{ rule.dayOfMonth }} · {{ categoryName(rule) }} · {{ ruleMoney(rule) }}</p></div><span class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase" :class="rule.kind === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">{{ rule.kind === 'income' ? 'Renda' : 'Conta' }}</span></div><button class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black" :class="rule.kind === 'income' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'" :disabled="settlingId === rule.id" @click="settle(rule)"><CheckCircle2 :size="17" />{{ settlingId === rule.id ? 'Confirmando…' : rule.kind === 'income' ? 'Opa, já pingou!' : 'Essa dívida eu já paguei' }}</button></article></div><p class="mt-3 text-xs text-amber-700 dark:text-amber-300">Sem resposta por 3 dias? A despesa será registrada automaticamente apenas se houver saldo.</p></div>

    <div v-if="store.recurringRules.length" class="divide-y divide-slate-100 px-5 dark:divide-slate-800 sm:px-6"><article v-for="rule in store.recurringRules" :key="rule.id" class="flex items-center gap-3 py-4"><div class="grid size-10 shrink-0 place-items-center rounded-2xl" :class="rule.kind === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' : 'bg-violet-100 text-violet-700 dark:bg-violet-950'"><CalendarDays :size="18" /></div><div class="min-w-0 flex-1"><p class="truncate text-sm font-black">{{ rule.description }}</p><p class="truncate text-xs text-slate-500">Próximo: {{ dueDate(rule) }} · {{ ruleMoney(rule) }}<span v-if="rule.reminderEnabled"> · 🔔</span></p></div><button class="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" :aria-label="`Remover recorrência ${rule.description}`" @click="removingRule = rule"><Trash2 :size="16" /></button></article></div>
    <div v-else class="px-5 pb-6 text-sm text-slate-500 sm:px-6">Nenhum compromisso mensal ainda. O Pingo está estranhando essa paz toda. 👀</div>
    <p v-if="error" class="mx-5 mb-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 sm:mx-6">{{ error }}</p>
  </section>
  <ConfirmDialog v-if="removingRule" title="Remover compromisso?" :message="`“${removingRule.description}” não aparecerá mais na agenda mensal. Transações já registradas serão mantidas.`" confirm-label="Remover compromisso" :busy="removing" @cancel="removingRule = null" @confirm="confirmRemoval" />
</template>
