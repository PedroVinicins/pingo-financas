<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowDownToLine, ArrowUpFromLine, Bot, History, Paintbrush, PiggyBank,
  Plus, ShieldCheck, Sparkles, Trash2, TrendingUp,
} from 'lucide-vue-next'
import AddVaultModal from '../components/AddVaultModal.vue'
import VaultMoveSheet from '../components/VaultMoveSheet.vue'
import VaultCustomizeSheet from '../components/VaultCustomizeSheet.vue'
import { centsToDecimal, decimalToCents, useFinanceStore } from '../stores/financeStore'
import type {
  AutomaticReserveRule, MoveVaultMoneyInput, NewVaultInput, UpdateVaultInput,
  Vault, VaultMovementType,
} from '../types/finance'

const store = useFinanceStore()
const showAdd = ref(false)
const movingVault = ref<Vault | null>(null)
const customizingVault = ref<Vault | null>(null)
const movementKind = ref<VaultMovementType>('deposit')
const totalProjectedYieldCents = computed(() => store.vaults.reduce((total, vault) => total + projectedYield(vault), 0n))

function money(value: bigint) { return store.balanceHidden ? 'R$ •••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centsToDecimal(value))) }
function projectedYield(vault: Vault) { return vault.annualYieldRate ? (decimalToCents(vault.balance) * decimalToCents(vault.annualYieldRate)) / 10_000n : 0n }
function progress(vault: Vault) { if (!vault.targetAmount) return 0; const target = decimalToCents(vault.targetAmount); return target > 0n ? Math.min(100, Number((decimalToCents(vault.balance) * 10_000n) / target) / 100) : 0 }
function openMovement(vault: Vault, kind: VaultMovementType) { movingVault.value = vault; movementKind.value = kind }
function movementDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
async function addVault(input: NewVaultInput) { try { await store.createVault(input); showAdd.value = false } catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Não foi possível criar o cofre.') } }
async function saveMovement(input: MoveVaultMoneyInput) { try { await store.moveVaultMoney(input); movingVault.value = null } catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Não foi possível transferir.') } }
async function saveCustomization(vault: UpdateVaultInput, reserve: AutomaticReserveRule) { try { await store.customizeVault(vault); store.saveAutomaticReserve(reserve); customizingVault.value = null } catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Não foi possível personalizar.') } }
async function remove(vault: Vault) { if (window.confirm(`Remover “${vault.name}”? O saldo guardado voltará a aparecer como disponível na conta.`)) await store.removeVault(vault.id) }
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
    <section class="flex items-end justify-between gap-4"><div><p class="text-sm font-bold text-amber-600">Pingo Cofres</p><h2 class="text-3xl font-black tracking-tight">Porquinhos com personalidade</h2><p class="mt-1 text-sm text-slate-500">Separe dinheiro sem perder a visão do patrimônio total.</p></div><button class="hidden items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white dark:bg-white dark:text-slate-950 sm:flex" @click="showAdd = true"><Plus :size="18" /> Novo cofre</button></section>

    <section class="relative mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-300 via-orange-300 to-rose-400 p-6 text-slate-950 shadow-xl sm:p-8"><div class="absolute -right-14 -top-14 size-44 rounded-full bg-white/25"></div><div class="relative flex items-start justify-between gap-4"><div><div class="grid size-12 place-items-center rounded-2xl bg-white/45"><PiggyBank :size="25" /></div><p class="mt-5 text-sm font-bold text-slate-800/70">Total nos porquinhos</p><h3 class="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{{ money(store.vaultTotalCents) }}</h3><p class="mt-3 text-sm font-semibold text-slate-800/70">Na conta principal: {{ money(store.availableBalanceCents) }}</p></div><Sparkles :size="34" class="relative text-white/75" /></div></section>

    <section class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p class="text-xs font-bold text-slate-400">Porquinhos</p><p class="mt-1 text-2xl font-black">{{ store.vaults.length }}</p></div><div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p class="text-xs font-bold text-slate-400">Rendimento estimado</p><p class="mt-1 text-lg font-black text-emerald-600">{{ money(totalProjectedYieldCents) }}/ano</p></div><div class="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:col-span-1"><p class="text-xs font-bold text-slate-400">Cobertura da reserva</p><p class="mt-1 text-2xl font-black">{{ store.emergencyFundMonths.toFixed(1) }} meses</p></div></section>

    <section v-if="store.vaults.length" class="mt-5 grid gap-4 md:grid-cols-2">
      <article v-for="vault in store.vaults" :key="vault.id" class="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"><div class="h-2" :style="{ backgroundColor: vault.color }"></div><div class="absolute -right-12 top-8 size-36 rounded-full opacity-[0.07]" :style="{ backgroundColor: vault.color }"></div><div class="relative p-5">
        <div class="flex items-start justify-between gap-3"><div class="flex min-w-0 items-center gap-3"><div class="grid size-14 shrink-0 place-items-center rounded-[1.25rem] text-3xl shadow-inner" :style="{ backgroundColor: `${vault.color}22` }">{{ vault.emoji || '🔐' }}</div><div class="min-w-0"><h3 class="truncate text-lg font-black">{{ vault.name }}</h3><p class="truncate text-xs font-semibold text-slate-500">{{ vault.institution }}</p><span v-if="store.getAutomaticReserveRule(vault.id)?.enabled" class="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950"><Bot :size="11" /> Reserva automática</span></div></div><div class="flex"><button class="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-amber-50 hover:text-amber-700" aria-label="Personalizar" @click="customizingVault = vault"><Paintbrush :size="16" /></button><button class="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover" @click="remove(vault)"><Trash2 :size="16" /></button></div></div>
        <p class="mt-5 text-xs font-bold text-slate-400">Saldo guardado</p><p class="mt-1 text-3xl font-black">{{ money(decimalToCents(vault.balance)) }}</p>
        <div v-if="vault.targetAmount" class="mt-4"><div class="mb-1.5 flex justify-between text-xs font-bold"><span>Meta {{ money(decimalToCents(vault.targetAmount)) }}</span><span>{{ progress(vault).toFixed(0) }}%</span></div><div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full" :style="{ width: `${progress(vault)}%`, backgroundColor: vault.color }"></div></div></div>
        <div v-if="vault.annualYieldRate" class="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30"><span class="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300"><TrendingUp :size="16" /> {{ vault.annualYieldRate }}% a.a.</span><span class="text-xs font-black text-emerald-700 dark:text-emerald-300">+{{ money(projectedYield(vault)) }}/ano</span></div>
        <div class="mt-5 grid grid-cols-2 gap-2"><button class="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950" @click="openMovement(vault, 'deposit')"><ArrowDownToLine :size="17" /> Conta → Cofre</button><button class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black dark:border-slate-700" @click="openMovement(vault, 'withdraw')"><ArrowUpFromLine :size="17" /> Cofre → Conta</button></div>
        <div v-if="store.getMovementsForVault(vault.id).length" class="mt-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p class="mb-2 flex items-center gap-2 text-xs font-black text-slate-500"><History :size="14" /> Últimas transferências</p><div v-for="movement in store.getMovementsForVault(vault.id).slice(0, 3)" :key="movement.id" class="flex items-center justify-between gap-2 py-1 text-xs"><span class="truncate text-slate-500">{{ movement.kind === 'deposit' ? 'Guardou' : 'Retirou' }} · {{ movement.source === 'automatic' ? 'automática' : movementDate(movement.occurredAt) }}</span><strong :class="movement.kind === 'deposit' ? 'text-emerald-600' : 'text-amber-600'">{{ movement.kind === 'deposit' ? '+' : '-' }}{{ money(decimalToCents(movement.amount)) }}</strong></div></div>
      </div></article>
    </section>

    <section v-else class="mt-6 grid min-h-[340px] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"><div class="max-w-sm"><div class="mx-auto grid size-16 place-items-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><PiggyBank :size="30" /></div><h3 class="mt-5 text-2xl font-black">Adote seu primeiro porquinho</h3><p class="mt-2 text-sm text-slate-500">Dê nome, cor, emoji, meta e até uma reserva automática para ele.</p><button class="mt-5 rounded-2xl bg-amber-400 px-5 py-3 font-black text-slate-950" @click="showAdd = true"><Plus :size="18" class="mr-1 inline" /> Adicionar cofre</button></div></section>
    <aside class="mt-5 flex gap-3 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300"><ShieldCheck :size="20" class="shrink-0" /><p><strong>Controle gerenciável:</strong> o Pingo registra a transferência entre conta e cofre, mas não movimenta dinheiro no banco real.</p></aside>
  </main>

  <button class="fixed bottom-28 right-4 z-30 grid size-14 place-items-center rounded-2xl bg-amber-400 text-slate-950 shadow-xl sm:hidden" aria-label="Adicionar cofre" @click="showAdd = true"><Plus :size="25" /></button>
  <AddVaultModal v-if="showAdd" @close="showAdd = false" @save="addVault" />
  <VaultMoveSheet v-if="movingVault" :vault="movingVault" :initial-kind="movementKind" :available-balance="money(store.availableBalanceCents)" @close="movingVault = null" @save="saveMovement" />
  <VaultCustomizeSheet v-if="customizingVault" :vault="customizingVault" :automatic-rule="store.getAutomaticReserveRule(customizingVault.id)" @close="customizingVault = null" @save="saveCustomization" />
</template>
