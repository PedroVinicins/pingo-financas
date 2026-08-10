<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import {
  Check, Building2, Copy, Lock, Palette, Plus, ReceiptText, Snowflake, Star, Trash2, WalletCards, Zap,
} from 'lucide-vue-next'
import AddDebitCardModal from '../components/AddDebitCardModal.vue'
import CardStyleEditor from '../components/CardStyleEditor.vue'
import DebitCardVisual from '../components/DebitCardVisual.vue'
import TransactionList from '../components/TransactionList.vue'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import { quickExpenseLink } from '../services/quickLaunch'
import type { NewDebitCardInput, UpdateDebitCardStyleInput } from '../types/finance'

const props = defineProps<{ focusCardId?: string }>()
const emit = defineEmits<{ quickExpense: [cardId: string] }>()
const store = useFinanceStore()
const showAddCard = ref(false)
const showStyleEditor = ref(false)
const selectedCardId = ref('')
const copied = ref(false)

watchEffect(() => {
  if (!store.debitCards.length) { selectedCardId.value = ''; return }
  if (!store.debitCards.some((card) => card.id === selectedCardId.value)) selectedCardId.value = store.defaultDebitCard?.id ?? store.debitCards[0].id
})
watch(() => props.focusCardId, (id) => { if (id && store.debitCards.some((card) => card.id === id)) selectedCardId.value = id }, { immediate: true })

const selectedCard = computed(() => store.debitCards.find((card) => card.id === selectedCardId.value) ?? null)
const selectedTransactions = computed(() => selectedCard.value ? store.getTransactionsForCard(selectedCard.value.id) : [])
const monthSpentCents = computed(() => selectedCard.value ? store.currentMonthExpensesByDebitCard.get(selectedCard.value.id) ?? 0n : 0n)
const totalSpentCents = computed(() => selectedCard.value ? store.expensesByDebitCard.get(selectedCard.value.id) ?? 0n : 0n)
const averagePurchaseCents = computed(() => selectedTransactions.value.length ? totalSpentCents.value / BigInt(selectedTransactions.value.length) : 0n)
const monthLimitCents = computed(() => selectedCard.value?.monthlySpendingLimit ? decimalToCents(selectedCard.value.monthlySpendingLimit) : null)
const limitProgress = computed(() => {
  const limit = monthLimitCents.value
  if (!limit || limit <= 0n) return 0
  return Math.min(100, Number((monthSpentCents.value * 10_000n) / limit) / 100)
})

function money(value: bigint | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value)))
}

async function addCard(input: NewDebitCardInput) { const card = await store.createDebitCard(input); selectedCardId.value = card.id; showAddCard.value = false }
async function saveStyle(input: UpdateDebitCardStyleInput) { await store.updateCardStyle(input); showStyleEditor.value = false }
async function toggleFrozen() { if (selectedCard.value) await store.setCardFrozen(selectedCard.value.id, !selectedCard.value.isFrozen) }
async function makeDefault() { if (selectedCard.value) await store.makeDefaultCard(selectedCard.value.id) }
async function removeCard() { if (!selectedCard.value || !window.confirm(`Remover ${selectedCard.value.name}? As despesas continuarão no histórico geral.`)) return; await store.removeDebitCard(selectedCard.value.id) }
async function copyShortcut() {
  if (!selectedCard.value) return
  try {
    await navigator.clipboard.writeText(quickExpenseLink(selectedCard.value.id))
    copied.value = true
  } catch {
    window.prompt('Copie o atalho do cartão:', quickExpenseLink(selectedCard.value.id))
    return
  }
  window.setTimeout(() => { copied.value = false }, 1800)
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <section class="flex items-end justify-between gap-4">
      <div><p class="text-sm font-bold text-violet-600">Pingo Wallet</p><h2 class="text-3xl font-black tracking-tight">Seus cartões</h2><p class="mt-1 text-sm text-slate-500">Cada cartão organiza compras diferentes, mas todos usam o mesmo saldo.</p></div>
      <button class="hidden items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white dark:bg-white dark:text-slate-950 sm:flex" @click="showAddCard = true"><Plus :size="18" /> Novo cartão</button>
    </section>

    <section v-if="store.debitCards.length" class="mt-5">
      <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 sm:mx-0 sm:px-0">
        <button v-for="card in store.debitCards" :key="card.id" class="w-[86vw] max-w-[350px] shrink-0 snap-center text-left transition" :class="selectedCardId === card.id ? 'opacity-100' : 'scale-[.96] opacity-60'" @click="selectedCardId = card.id"><DebitCardVisual :card="card" /></button>
        <button class="grid aspect-[1.586/1] w-[70vw] max-w-[280px] shrink-0 snap-center place-items-center rounded-[1.75rem] border-2 border-dashed border-slate-300 text-slate-500 dark:border-slate-700" @click="showAddCard = true"><span class="grid place-items-center gap-2 text-sm font-bold"><Plus :size="25" /> Adicionar cartão</span></button>
      </div>

      <template v-if="selectedCard">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0"><div class="flex items-center gap-2"><h3 class="truncate text-xl font-black">{{ selectedCard.name }}</h3><Star v-if="selectedCard.isDefault" :size="15" class="text-amber-500" fill="currentColor" /></div><p class="text-xs text-slate-500">{{ selectedCard.issuer }} · •••• {{ selectedCard.lastFour }}</p></div>
            <span v-if="selectedCard.isFrozen" class="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Snowflake :size="12" /> Congelado</span>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[11px] font-bold text-slate-400">Este mês</p><p class="mt-1 font-black">{{ money(monthSpentCents) }}</p></div>
            <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[11px] font-bold text-slate-400">Média/compra</p><p class="mt-1 font-black">{{ money(averagePurchaseCents) }}</p></div>
            <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[11px] font-bold text-slate-400">Compras</p><p class="mt-1 font-black">{{ selectedTransactions.length }}</p></div>
            <div class="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="text-[11px] font-bold text-slate-400">Histórico</p><p class="mt-1 font-black">{{ money(totalSpentCents) }}</p></div>
          </div>

          <div v-if="monthLimitCents" class="mt-4"><div class="mb-1.5 flex justify-between text-xs font-bold"><span>Controle mensal</span><span class="text-slate-500">{{ limitProgress.toFixed(0) }}%</span></div><div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-emerald-400" :style="{ width: `${limitProgress}%` }"></div></div></div>

          <div class="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button :disabled="selectedCard.isFrozen" class="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3.5 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 sm:col-auto" @click="emit('quickExpense', selectedCard.id)"><Zap :size="18" fill="currentColor" /> Gasto neste cartão</button>
            <button class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold dark:border-slate-700" @click="showStyleEditor = true"><Palette :size="17" /> Personalizar</button>
            <button class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold dark:border-slate-700" @click="copyShortcut"><Copy :size="17" /> {{ copied ? 'Copiado' : 'Atalho' }}</button>
            <button class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold dark:border-slate-700" @click="toggleFrozen"><Lock :size="17" /> {{ selectedCard.isFrozen ? 'Descongelar' : 'Congelar' }}</button>
            <button v-if="!selectedCard.isDefault" class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold dark:border-slate-700" @click="makeDefault"><Check :size="17" /> Principal</button>
            <button class="grid place-items-center rounded-2xl border border-rose-200 p-3 text-rose-600 dark:border-rose-900" @click="removeCard"><Trash2 :size="17" /></button>
          </div>
          <p class="mt-3 text-xs text-slate-400">O botão “Atalho” copia um link como <code>pingo://expense?card=...</code> para abrir o app direto neste cartão.</p>
        </section>

        <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_.38fr]">
          <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div class="mb-2 flex items-center gap-2"><ReceiptText :size="19" /><div><p class="text-xs font-bold text-slate-400">Histórico</p><h3 class="font-black">Compras com {{ selectedCard.name }}</h3></div></div><TransactionList :transactions="selectedTransactions" :categories="store.categories" :cards="store.debitCards" /></section>
          <aside class="rounded-[1.75rem] bg-slate-950 p-5 text-white dark:bg-slate-900"><Building2 :size="20" /><p class="mt-5 text-xs font-bold text-slate-400">Saldo da conta</p><p class="mt-1 text-3xl font-black">{{ money(store.balanceCents) }}</p><p class="mt-3 text-xs leading-5 text-slate-400">O Pingo não cria um saldo artificial para cada cartão. Todo gasto reduz o mesmo caixa.</p></aside>
        </div>
      </template>
    </section>

    <section v-else class="mt-6 grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"><div class="max-w-sm"><div class="mx-auto grid size-16 place-items-center rounded-3xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><WalletCards :size="30" /></div><h3 class="mt-5 text-2xl font-black">Monte sua Pingo Wallet</h3><p class="mt-2 text-sm text-slate-500">Adicione cartões com cores, texturas e stickers. Guardamos somente os 4 últimos dígitos.</p><button class="mt-5 rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950" @click="showAddCard = true">Adicionar primeiro cartão</button></div></section>
  </main>

  <AddDebitCardModal v-if="showAddCard" :existing-cards-count="store.debitCards.length" @close="showAddCard = false" @save="addCard" />
  <CardStyleEditor v-if="showStyleEditor && selectedCard" :card="selectedCard" @close="showStyleEditor = false" @save="saveStyle" />
</template>
