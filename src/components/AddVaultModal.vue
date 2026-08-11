<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Landmark, ShieldCheck, X } from 'lucide-vue-next'
import type { NewVaultInput, VaultType } from '../types/finance'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'

const emit = defineEmits<{ close: []; save: [input: NewVaultInput] }>()
const error = ref('')
const form = reactive({
  name: 'Reserva de emergência',
  institution: 'Banco Inter',
  type: 'piggy_bank' as VaultType,
  initialBalance: '',
  targetAmount: '',
  annualYieldRate: '',
  color: '#F97316',
  emoji: '🐷',
})

const colors = ['#F97316', '#8B5CF6', '#0EA5E9', '#10B981', '#F43F5E', '#0F172A']

function decimal(value: string, allowZero = false) {
  let normalized: string
  try {
    normalized = localizedDecimalToStorage(value)
  } catch {
    return null
  }
  if (allowZero ? Number(normalized) < 0 : Number(normalized) <= 0) return null
  return normalized
}

function submit() {
  error.value = ''
  const initialBalance = form.initialBalance.trim() ? decimal(form.initialBalance, true) : '0.00'
  const targetAmount = form.targetAmount.trim() ? decimal(form.targetAmount) : null
  const annualYieldRate = form.annualYieldRate.trim() ? decimal(form.annualYieldRate, true) : null
  if (!form.name.trim() || !form.institution.trim()) error.value = 'Preencha o nome e a instituição.'
  else if (initialBalance === null || targetAmount === null && form.targetAmount.trim() || annualYieldRate === null && form.annualYieldRate.trim()) error.value = 'Confira os valores informados.'
  else if (annualYieldRate && Number(annualYieldRate) > 1000) error.value = 'A rentabilidade anual deve ser menor que 1.000%.'
  else emit('save', {
    name: form.name.trim(), institution: form.institution.trim(), type: form.type,
    initialBalance, targetAmount, annualYieldRate, color: form.color, emoji: form.emoji || null,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-[70] grid place-items-end bg-slate-950/55 sm:place-items-center sm:p-4" @click.self="emit('close')">
    <form class="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-xl sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm font-bold text-amber-600">Pingo Cofres</p><h2 class="text-2xl font-black">Adicionar dinheiro guardado</h2></div>
        <button type="button" class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button>
      </div>

      <div class="mt-5 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
        <ShieldCheck :size="20" class="mt-0.5 shrink-0" /><p>O Pingo apenas organiza os valores. Ele não movimenta dinheiro no banco.</p>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">Nome do cofre<input v-model="form.name" maxlength="50" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Ex.: Reserva de emergência" /></label>
        <label class="grid gap-1.5 text-sm font-semibold">Banco / instituição<input v-model="form.institution" maxlength="60" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Ex.: Nubank" /></label>
        <label class="grid gap-1.5 text-sm font-semibold">Tipo<select v-model="form.type" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700"><option value="piggy_bank">Porquinho</option><option value="box">Caixinha</option><option value="savings">Poupança</option><option value="investment">Investimento</option><option value="cash">Dinheiro físico</option></select></label>
        <label class="grid gap-1.5 text-sm font-semibold">Saldo guardado<LocalizedNumberInput v-model="form.initialBalance" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="0,00" /></label>
        <label class="grid gap-1.5 text-sm font-semibold">Meta <span class="font-normal text-slate-400">(opcional)</span><LocalizedNumberInput v-model="form.targetAmount" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="3.000,00" /></label>
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">Rentabilidade estimada ao ano <span class="font-normal text-slate-400">(opcional)</span><LocalizedNumberInput v-model="form.annualYieldRate" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Ex.: 12,00%" /></label>
      </div>

      <div class="mt-5 flex items-center gap-3"><Landmark :size="18" /><p class="text-sm font-black">Cor e ícone</p></div>
      <div class="mt-2 flex flex-wrap gap-2"><button v-for="color in colors" :key="color" type="button" class="size-10 rounded-full border-4" :class="form.color === color ? 'border-slate-950 dark:border-white' : 'border-transparent'" :style="{ backgroundColor: color }" @click="form.color = color"></button><input v-model="form.emoji" maxlength="4" class="h-10 w-16 rounded-xl border border-slate-200 bg-transparent text-center text-xl dark:border-slate-700" aria-label="Emoji do cofre" /></div>

      <p v-if="error" class="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{{ error }}</p>
      <button class="mt-6 w-full rounded-2xl bg-slate-950 py-3.5 font-black text-white dark:bg-amber-400 dark:text-slate-950">Criar cofre</button>
    </form>
  </div>
</template>
