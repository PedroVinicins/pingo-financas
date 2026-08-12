<script setup lang="ts">
import { ref } from 'vue'
import { BellRing, CalendarDays, CheckCircle2, CircleDollarSign, Plus, ReceiptText, Trash2 } from 'lucide-vue-next'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import RecurringRuleModal from './RecurringRuleModal.vue'
import type { NewRecurringRuleInput, RecurringRule } from '../types/finance'

const store = useFinanceStore()
const showAdd = ref(false)
const error = ref('')
const settlingId = ref('')

function money(value: bigint) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value)))
}
function ruleMoney(rule: RecurringRule) { return money(decimalToCents(rule.amount)) }
function categoryName(rule: RecurringRule) { return store.categories.find((item) => item.id === rule.categoryId)?.name ?? 'Sem categoria' }
async function save(input: NewRecurringRuleInput) {
  error.value = ''
  try { await store.createRecurringRule(input); showAdd.value = false } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível criar.' }
}
async function settle(rule: RecurringRule) {
  error.value = ''
  settlingId.value = rule.id
  try { await store.settleRecurringRule(rule.id) } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Não foi possível confirmar.' }
  finally { settlingId.value = '' }
}
async function remove(rule: RecurringRule) {
  if (window.confirm(`Remover “${rule.description}” das recorrências?`)) await store.removeRecurringRule(rule.id)
}
</script>

<template>
  <section class="mt-5 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-start justify-between gap-3 p-5 sm:p-6"><div><p class="text-sm font-bold text-violet-600">Piloto mensal</p><h3 class="text-xl font-black">Rendas, contas e assinaturas</h3><p class="mt-1 text-sm text-slate-500">O Pingo lembra; você confirma antes de mexer no saldo.</p></div><button class="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-violet-500 px-3 py-2.5 text-sm font-black text-white" @click="showAdd = true"><Plus :size="17" /><span class="hidden sm:inline">Adicionar</span></button></div>

    <div class="grid grid-cols-2 gap-3 px-5 pb-5 sm:px-6"><div class="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/25"><div class="flex items-center gap-2 text-xs font-bold text-rose-600"><ReceiptText :size="15" /> Contas por mês</div><p class="mt-2 text-xl font-black">{{ money(store.fixedMonthlyCommitmentCents) }}</p></div><div class="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/25"><div class="flex items-center gap-2 text-xs font-bold text-emerald-600"><CircleDollarSign :size="15" /> Rendas previstas</div><p class="mt-2 text-xl font-black">{{ money(store.expectedMonthlyIncomeCents) }}</p></div></div>

    <div v-if="store.dueRecurringRules.length" class="border-y border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900 dark:bg-amber-950/20 sm:p-6"><div class="mb-3 flex items-center gap-2 text-sm font-black text-amber-700 dark:text-amber-300"><BellRing :size="18" /> Precisa da sua confirmação</div><div class="grid gap-3"><article v-for="rule in store.dueRecurringRules" :key="rule.id" class="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate font-black">{{ rule.description }}</p><p class="mt-1 text-xs text-slate-500">Dia {{ rule.dayOfMonth }} · {{ categoryName(rule) }} · {{ ruleMoney(rule) }}</p></div><span class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase" :class="rule.kind === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">{{ rule.kind === 'income' ? 'Renda' : 'Conta' }}</span></div><button class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black" :class="rule.kind === 'income' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'" :disabled="settlingId === rule.id" @click="settle(rule)"><CheckCircle2 :size="17" />{{ settlingId === rule.id ? 'Confirmando…' : rule.kind === 'income' ? 'Opa, já pingou!' : 'Essa dívida eu já paguei' }}</button></article></div><p class="mt-3 text-xs text-amber-700 dark:text-amber-300">Sem resposta por 3 dias? A despesa será registrada automaticamente apenas se houver saldo.</p></div>

    <div v-if="store.recurringRules.length" class="divide-y divide-slate-100 px-5 dark:divide-slate-800 sm:px-6"><article v-for="rule in store.recurringRules" :key="rule.id" class="flex items-center gap-3 py-4"><div class="grid size-10 shrink-0 place-items-center rounded-2xl" :class="rule.kind === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' : 'bg-violet-100 text-violet-700 dark:bg-violet-950'"><CalendarDays :size="18" /></div><div class="min-w-0 flex-1"><p class="truncate text-sm font-black">{{ rule.description }}</p><p class="truncate text-xs text-slate-500">Todo dia {{ rule.dayOfMonth }} · {{ ruleMoney(rule) }}<span v-if="rule.reminderEnabled"> · 🔔</span></p></div><button class="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover recorrência" @click="remove(rule)"><Trash2 :size="16" /></button></article></div>
    <div v-else class="px-5 pb-6 text-sm text-slate-500 sm:px-6">Cadastre salário, streaming, recarga, internet ou qualquer valor que se repete todo mês.</div>
    <p v-if="error" class="mx-5 mb-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 sm:mx-6">{{ error }}</p>
  </section>
  <RecurringRuleModal v-if="showAdd" :categories="store.categories" :cards="store.debitCards" @close="showAdd = false" @save="save" />
</template>
