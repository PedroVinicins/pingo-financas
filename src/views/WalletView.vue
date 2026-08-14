<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import {
  CalendarDays, Check, Building2, Copy, FileText, Link2, Lock, Palette, Plus, QrCode,
  ReceiptText, Snowflake, Star, Trash2, WalletCards, X, Zap,
} from 'lucide-vue-next'
import AddDebitCardModal from '../components/AddDebitCardModal.vue'
import CardStyleEditor from '../components/CardStyleEditor.vue'
import DebitCardVisual from '../components/DebitCardVisual.vue'
import TransactionList from '../components/TransactionList.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import AddDigitalWalletItemModal from '../components/AddDigitalWalletItemModal.vue'
import AddWalletEntryMenu from '../components/AddWalletEntryMenu.vue'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import { quickExpenseLink } from '../services/quickLaunch'
import type { DigitalWalletItem, NewDebitCardInput, NewDigitalWalletItemInput, UpdateDebitCardStyleInput } from '../types/finance'

const props = defineProps<{ focusCardId?: string }>()
const emit = defineEmits<{ quickExpense: [cardId: string] }>()
const store = useFinanceStore()
const showAddCard = ref(false)
const showAddMenu = ref(false)
const showStyleEditor = ref(false)
const selectedCardId = ref('')
const selectedWalletItemId = ref('')
const copied = ref(false)
const showRemoveConfirmation = ref(false)
const removing = ref(false)
const manualShortcut = ref('')
const shortcutInput = ref<HTMLInputElement | null>(null)
const showAddWalletItem = ref(false)
const removingWalletItem = ref<DigitalWalletItem | null>(null)

watchEffect(() => {
  if (store.digitalWalletItems.some((item) => item.id === selectedWalletItemId.value)) return
  if (store.debitCards.some((card) => card.id === selectedCardId.value)) return
  if (store.debitCards.length) selectedCardId.value = store.defaultDebitCard?.id ?? store.debitCards[0].id
  else if (store.digitalWalletItems.length) selectedWalletItemId.value = store.digitalWalletItems[0].id
})
watch(() => props.focusCardId, (id) => {
  if (id && store.debitCards.some((card) => card.id === id)) selectCard(id)
}, { immediate: true })

const selectedCard = computed(() => store.debitCards.find((card) => card.id === selectedCardId.value) ?? null)
const selectedWalletItem = computed(() => store.digitalWalletItems.find((item) => item.id === selectedWalletItemId.value) ?? null)
const walletEntriesCount = computed(() => store.debitCards.length + store.digitalWalletItems.length)
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
  if (store.balanceHidden) return 'R$ •••••'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value)))
}
function selectCard(id: string) { selectedCardId.value = id; selectedWalletItemId.value = '' }
function selectWalletItem(id: string) { selectedWalletItemId.value = id; selectedCardId.value = '' }
function addDebitCardChoice() { showAddMenu.value = false; showAddCard.value = true }
function addLiveCardChoice() { showAddMenu.value = false; showAddWalletItem.value = true }

async function addCard(input: NewDebitCardInput) {
  try {
    const card = await store.createDebitCard(input)
    selectCard(card.id)
    showAddCard.value = false
    store.showFeedback('Cartão adicionado à carteira.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível adicionar o cartão.') }
}
async function saveStyle(input: UpdateDebitCardStyleInput) {
  try { await store.updateCardStyle(input); showStyleEditor.value = false }
  catch (cause) { store.reportError(cause, 'Não foi possível personalizar o cartão.') }
}
async function toggleFrozen() {
  if (!selectedCard.value) return
  try {
    const frozen = !selectedCard.value.isFrozen
    await store.setCardFrozen(selectedCard.value.id, frozen)
    store.showFeedback(frozen ? 'Cartão congelado no Pingo.' : 'Cartão liberado para novos lançamentos.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível alterar o cartão.') }
}
async function makeDefault() {
  if (!selectedCard.value) return
  try { await store.makeDefaultCard(selectedCard.value.id); store.showFeedback('Cartão principal atualizado.', 'success') }
  catch (cause) { store.reportError(cause, 'Não foi possível definir o cartão principal.') }
}
async function removeCard() {
  if (!selectedCard.value) return
  removing.value = true
  try {
    await store.removeDebitCard(selectedCard.value.id)
    showRemoveConfirmation.value = false
    store.showFeedback('Cartão removido; as compras continuam no histórico geral.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível remover o cartão.') }
  finally { removing.value = false }
}
async function copyShortcut() {
  if (!selectedCard.value) return
  try {
    await navigator.clipboard.writeText(quickExpenseLink(selectedCard.value.id))
    copied.value = true
  } catch {
    manualShortcut.value = quickExpenseLink(selectedCard.value.id)
    await nextTick()
    shortcutInput.value?.focus()
    shortcutInput.value?.select()
    return
  }
  window.setTimeout(() => { copied.value = false }, 1800)
}
async function addWalletItem(input: NewDigitalWalletItemInput) {
  try {
    const item = await store.createDigitalWalletItem(input)
    selectWalletItem(item.id)
    showAddWalletItem.value = false
    store.showFeedback('Item guardado na carteira deste dispositivo.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível guardar o item.') }
}
async function deleteWalletItem() {
  if (!removingWalletItem.value) return
  try {
    await store.removeDigitalWalletItem(removingWalletItem.value.id)
    selectedWalletItemId.value = ''
    removingWalletItem.value = null
    store.showFeedback('Item removido da carteira.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível remover o item.') }
}
function walletKindLabel(kind: DigitalWalletItem['kind']) {
  return ({ ticket: 'Ingresso', document: 'Documento', qr_code: 'QR Code', other: 'Outro' })[kind]
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`))
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <section class="flex items-end justify-between gap-4">
      <div><p class="text-sm font-bold text-violet-600">Pingo Wallet</p><h2 class="text-3xl font-black tracking-tight">Sua carteira</h2><p class="mt-1 text-sm text-slate-500">Cartões de pagamento, ingressos, documentos e QR Codes no mesmo lugar.</p></div>
      <button class="hidden items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white dark:bg-white dark:text-slate-950 sm:flex" @click="showAddMenu = true"><Plus :size="18" /> Novo cartão</button>
    </section>

    <section v-if="walletEntriesCount" class="mt-5">
      <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 sm:mx-0 sm:px-0">
        <button v-for="card in store.debitCards" :key="card.id" class="w-[86vw] max-w-[350px] shrink-0 snap-center text-left transition" :class="selectedCardId === card.id ? 'opacity-100' : 'scale-[.96] opacity-60'" @click="selectCard(card.id)"><DebitCardVisual :card="card" /></button>
        <button v-for="item in store.digitalWalletItems" :key="item.id" class="relative aspect-[1.586/1] w-[86vw] max-w-[350px] shrink-0 snap-center overflow-hidden rounded-[1.75rem] text-left shadow-card transition" :class="selectedWalletItemId === item.id ? 'opacity-100' : 'scale-[.96] opacity-60'" @click="selectWalletItem(item.id)"><img v-if="item.fileDataUrl && item.mimeType?.startsWith('image/')" :src="item.fileDataUrl" alt="" class="absolute inset-0 size-full object-cover" /><span class="absolute inset-0 bg-gradient-to-br from-violet-700/95 via-violet-600/90 to-sky-500/90"></span><span class="relative flex h-full flex-col justify-between p-5 text-white"><span class="flex items-start justify-between"><span class="grid size-11 place-items-center rounded-2xl bg-white/20"><QrCode v-if="item.kind === 'qr_code'" :size="23" /><FileText v-else :size="23" /></span><span class="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider">Ao vivo</span></span><span><span class="block text-xs font-bold text-white/70">{{ walletKindLabel(item.kind) }}</span><strong class="mt-1 block truncate text-xl">{{ item.title }}</strong><span class="mt-1 block truncate text-xs text-white/70">{{ item.issuer || 'Disponível offline' }}</span></span></span></button>
        <button class="grid aspect-[1.586/1] w-[70vw] max-w-[280px] shrink-0 snap-center place-items-center rounded-[1.75rem] border-2 border-dashed border-slate-300 text-slate-500 dark:border-slate-700" @click="showAddMenu = true"><span class="grid place-items-center gap-2 text-sm font-bold"><Plus :size="25" /> Adicionar à carteira</span></button>
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
            <button class="grid place-items-center rounded-2xl border border-rose-200 p-3 text-rose-600 dark:border-rose-900" :aria-label="`Remover ${selectedCard.name}`" @click="showRemoveConfirmation = true"><Trash2 :size="17" /></button>
          </div>
          <p class="mt-3 text-xs text-slate-400">O botão “Atalho” copia um link como <code>pingo://expense?card=...</code> para abrir o app direto neste cartão.</p>
        </section>

        <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_.38fr]">
          <section class="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div class="mb-2 flex items-center gap-2"><ReceiptText :size="19" /><div><p class="text-xs font-bold text-slate-400">Histórico</p><h3 class="font-black">Compras com {{ selectedCard.name }}</h3></div></div><TransactionList :transactions="selectedTransactions" :categories="store.categories" :cards="store.debitCards" /></section>
          <aside class="rounded-[1.75rem] bg-slate-950 p-5 text-white dark:bg-slate-900"><Building2 :size="20" /><p class="mt-5 text-xs font-bold text-slate-400">Saldo da conta</p><p class="mt-1 text-3xl font-black">{{ money(store.balanceCents) }}</p><p class="mt-3 text-xs leading-5 text-slate-400">O Pingo não cria um saldo artificial para cada cartão. Todo gasto reduz o mesmo caixa.</p></aside>
        </div>
      </template>
      <section v-else-if="selectedWalletItem" class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"><div v-if="selectedWalletItem.fileDataUrl && selectedWalletItem.mimeType?.startsWith('image/')" class="max-h-[420px] overflow-hidden bg-slate-100 dark:bg-slate-950"><img :src="selectedWalletItem.fileDataUrl" :alt="selectedWalletItem.title" class="mx-auto max-h-[420px] w-full object-contain" /></div><div v-else class="grid min-h-56 place-items-center bg-gradient-to-br from-violet-100 to-sky-100 text-violet-700 dark:from-violet-950 dark:to-sky-950 dark:text-violet-300"><QrCode v-if="selectedWalletItem.kind === 'qr_code'" :size="72" /><FileText v-else :size="72" /></div><div class="p-5 sm:p-6"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><span class="text-xs font-black uppercase tracking-wider text-violet-600">Cartão ao vivo · {{ walletKindLabel(selectedWalletItem.kind) }}</span><h3 class="mt-1 text-2xl font-black">{{ selectedWalletItem.title }}</h3><p v-if="selectedWalletItem.issuer" class="mt-1 text-sm text-slate-500">{{ selectedWalletItem.issuer }}</p></div><button class="grid size-11 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 dark:border-rose-900" :aria-label="`Remover ${selectedWalletItem.title}`" @click="removingWalletItem = selectedWalletItem"><Trash2 :size="18" /></button></div><p v-if="selectedWalletItem.expiresAt" class="mt-4 flex items-center gap-2 text-sm font-bold text-amber-600"><CalendarDays :size="17" /> Válido até {{ displayDate(selectedWalletItem.expiresAt) }}</p><p v-if="selectedWalletItem.qrValue" class="mt-4 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs dark:bg-slate-950">{{ selectedWalletItem.qrValue }}</p><p v-if="selectedWalletItem.notes" class="mt-4 text-sm leading-relaxed text-slate-500">{{ selectedWalletItem.notes }}</p><a v-if="selectedWalletItem.fileDataUrl" :href="selectedWalletItem.fileDataUrl" :download="selectedWalletItem.fileName || selectedWalletItem.title" class="mt-5 block rounded-2xl bg-violet-500 px-4 py-3 text-center text-sm font-black text-white">Abrir arquivo</a><p class="mt-4 text-xs text-slate-400">Este cartão fica somente neste dispositivo e está disponível offline.</p></div></section>
    </section>

    <section v-else class="mt-6 grid min-h-[360px] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"><div class="max-w-sm"><div class="mx-auto grid size-16 place-items-center rounded-3xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><WalletCards :size="30" /></div><h3 class="mt-5 text-2xl font-black">Monte sua Pingo Wallet</h3><p class="mt-2 text-sm text-slate-500">Adicione um cartão de débito, ingresso, documento ou QR Code.</p><button class="mt-5 rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950" @click="showAddMenu = true">Adicionar primeiro cartão</button></div></section>
  </main>

  <AddWalletEntryMenu v-if="showAddMenu" @close="showAddMenu = false" @card="addDebitCardChoice" @live="addLiveCardChoice" />
  <AddDebitCardModal v-if="showAddCard" :existing-cards-count="store.debitCards.length" @close="showAddCard = false" @save="addCard" />
  <CardStyleEditor v-if="showStyleEditor && selectedCard" :card="selectedCard" @close="showStyleEditor = false" @save="saveStyle" />
  <ConfirmDialog v-if="showRemoveConfirmation && selectedCard" title="Remover cartão?" :message="`“${selectedCard.name}” sairá da carteira. As despesas já registradas continuarão no histórico geral, sem vínculo com o cartão.`" confirm-label="Remover cartão" :busy="removing" @cancel="showRemoveConfirmation = false" @confirm="removeCard" />
  <AddDigitalWalletItemModal v-if="showAddWalletItem" @close="showAddWalletItem = false" @save="addWalletItem" />
  <ConfirmDialog v-if="removingWalletItem" title="Remover da carteira?" :message="`“${removingWalletItem.title}” e seu arquivo local serão apagados deste dispositivo.`" confirm-label="Remover item" @cancel="removingWalletItem = null" @confirm="deleteWalletItem" />
  <Teleport to="body">
    <div v-if="manualShortcut" class="fixed inset-0 z-[110] grid place-items-end bg-slate-950/55 backdrop-blur-[2px] sm:place-items-center sm:p-4" @click.self="manualShortcut = ''" @keydown.esc="manualShortcut = ''">
      <section class="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="shortcut-dialog-title">
        <div class="flex items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Link2 :size="20" /></div><div class="min-w-0 flex-1"><h2 id="shortcut-dialog-title" class="text-xl font-black">Copiar atalho</h2><p class="mt-1 text-sm text-slate-500">A cópia automática foi bloqueada. Selecione o endereço abaixo para copiá-lo manualmente.</p></div><button class="grid size-9 place-items-center rounded-xl text-slate-400" aria-label="Fechar" @click="manualShortcut = ''"><X :size="18" /></button></div>
        <input ref="shortcutInput" :value="manualShortcut" readonly class="mt-5 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950" aria-label="Endereço do atalho" @focus="($event.target as HTMLInputElement).select()" />
        <button class="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950" @click="manualShortcut = ''">Concluir</button>
      </section>
    </div>
  </Teleport>
</template>
