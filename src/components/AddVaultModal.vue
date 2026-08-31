<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ArrowRightLeft, Landmark, PiggyBank, ShieldCheck, X } from 'lucide-vue-next'
import type { AutomaticReserveMode, AutomaticReserveRule, MonthlyReserveRule, NewVaultInput, VaultType } from '../types/finance'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import AppModal from './AppModal.vue'

defineProps<{ availableBalance: string }>()
const emit = defineEmits<{
  close: []
  save: [
    input: NewVaultInput,
    automatic: Omit<AutomaticReserveRule, 'vaultId'>,
    monthly: Omit<MonthlyReserveRule, 'vaultId'>,
  ]
}>()
const error = ref('')
const form = reactive({
  name: 'Reserva de emergência',
  institution: '',
  type: 'piggy_bank' as VaultType,
  transferNow: true,
  initialBalance: '',
  targetAmount: '',
  annualYieldRate: '',
  color: '#F97316',
  emoji: '🐷',
  automaticEnabled: false,
  automaticMode: 'percentage' as AutomaticReserveMode,
  automaticValue: '10,00',
  monthlyEnabled: false,
  monthlyMode: 'fixed' as AutomaticReserveMode,
  monthlyValue: '50,00',
  monthlyDay: Math.min(28, new Date().getDate()),
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
  const initialBalance = form.transferNow ? decimal(form.initialBalance) : '0.00'
  const targetAmount = form.targetAmount.trim() ? decimal(form.targetAmount) : null
  const annualYieldRate = form.annualYieldRate.trim() ? decimal(form.annualYieldRate, true) : null
  const automaticValue = decimal(form.automaticValue)
  const monthlyValue = decimal(form.monthlyValue)
  if (!form.name.trim() || !form.institution.trim()) error.value = 'Preencha o nome e a instituição.'
  else if (initialBalance === null || targetAmount === null && form.targetAmount.trim() || annualYieldRate === null && form.annualYieldRate.trim()) error.value = 'Confira os valores informados.'
  else if (annualYieldRate && Number(annualYieldRate) > 1000) error.value = 'A rentabilidade anual deve ser menor que 1.000%.'
  else if (form.automaticEnabled && automaticValue === null) error.value = 'Confira a reserva feita ao receber uma entrada.'
  else if (form.automaticMode === 'percentage' && automaticValue && Number(automaticValue) > 100) error.value = 'A porcentagem por entrada deve ser de no máximo 100%.'
  else if (form.monthlyEnabled && monthlyValue === null) error.value = 'Confira o valor da reserva mensal.'
  else if (form.monthlyMode === 'percentage' && monthlyValue && Number(monthlyValue) > 100) error.value = 'A porcentagem mensal deve ser de no máximo 100%.'
  else if (!Number.isInteger(form.monthlyDay) || form.monthlyDay < 1 || form.monthlyDay > 28) error.value = 'Escolha um dia entre 1 e 28.'
  else emit('save', {
    name: form.name.trim(), institution: form.institution.trim(), type: form.type,
    initialBalance, targetAmount, annualYieldRate, color: form.color, emoji: form.emoji || null,
  }, {
    enabled: form.automaticEnabled, mode: form.automaticMode, value: automaticValue ?? '10.00',
  }, {
    enabled: form.monthlyEnabled, mode: form.monthlyMode, value: monthlyValue ?? '50.00',
    dayOfMonth: form.monthlyDay, lastProcessedPeriod: null,
  })
}
</script>

<template>
  <AppModal as="form" aria-labelledby="add-vault-title" root-class="z-[70]" panel-class="p-5 sm:max-w-xl sm:p-6" @close="emit('close')" @submit="submit">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm font-bold text-amber-600">Pingo Cofres</p><h2 id="add-vault-title" class="break-words text-2xl font-black">Criar novo porquinho</h2></div>
        <button type="button" class="pingo-modal-close" aria-label="Fechar" @click="emit('close')"><X :size="19" /></button>
      </div>

      <div class="mt-5 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
        <ShieldCheck :size="20" class="mt-0.5 shrink-0" /><p>O Pingo apenas organiza os valores. Ele não movimenta dinheiro no banco.</p>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">Nome do cofre<input v-model="form.name" maxlength="50" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Ex.: Reserva de emergência" /></label>
        <label class="grid gap-1.5 text-sm font-semibold">Banco / instituição<input v-model="form.institution" maxlength="60" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Ex.: Banco Inter" /></label>
        <label class="grid gap-1.5 text-sm font-semibold">Tipo<select v-model="form.type" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700"><option value="piggy_bank">Porquinho</option><option value="box">Caixinha</option><option value="savings">Poupança</option><option value="investment">Investimento</option><option value="cash">Dinheiro físico</option></select></label>
        <label class="grid gap-1.5 text-sm font-semibold">Meta <span class="font-normal text-slate-400">(opcional)</span><LocalizedNumberInput v-model="form.targetAmount" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="3.000,00" /></label>
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">Rentabilidade estimada ao ano <span class="font-normal text-slate-400">(opcional)</span><LocalizedNumberInput v-model="form.annualYieldRate" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Ex.: 12,00%" /></label>
      </div>

      <section class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/25">
        <div class="flex items-center gap-2"><ArrowRightLeft :size="18" class="text-amber-700" /><p class="text-sm font-black">Como o porquinho deve começar?</p></div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button type="button" class="rounded-xl border px-3 py-2.5 text-sm font-black" :class="form.transferNow ? 'border-amber-500 bg-white text-amber-800 dark:bg-slate-900' : 'border-amber-200 text-slate-500 dark:border-amber-900'" @click="form.transferNow = true">Transferir agora</button>
          <button type="button" class="rounded-xl border px-3 py-2.5 text-sm font-black" :class="!form.transferNow ? 'border-amber-500 bg-white text-amber-800 dark:bg-slate-900' : 'border-amber-200 text-slate-500 dark:border-amber-900'" @click="form.transferNow = false">Criar vazio</button>
        </div>
        <label v-if="form.transferNow" class="mt-4 grid gap-1.5 text-sm font-semibold">Quanto transferir da conta?<LocalizedNumberInput v-model="form.initialBalance" class="rounded-xl border border-amber-200 bg-white px-3 py-3 text-xl font-black dark:border-amber-900 dark:bg-slate-900" placeholder="0,00" /><span class="flex items-center gap-1.5 text-xs font-normal text-slate-500"><Landmark :size="13" /> Disponível na conta: {{ availableBalance }}</span></label>
        <div v-else class="mt-4 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-xs text-slate-500 dark:bg-slate-900/70"><PiggyBank :size="17" /><p>O porquinho será criado com R$ 0,00. Você poderá transferir depois.</p></div>
      </section>

      <section class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/25"><label class="flex cursor-pointer items-start gap-3"><input v-model="form.automaticEnabled" type="checkbox" class="mt-1 size-4 accent-emerald-600" /><span><strong class="block text-sm">Guardar quando entrar dinheiro</strong><span class="mt-1 block text-xs text-slate-500">A partir da próxima entrada, o Pingo separa automaticamente uma parte.</span></span></label><div v-if="form.automaticEnabled" class="mt-4 grid grid-cols-2 gap-2"><select v-model="form.automaticMode" class="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-emerald-900 dark:bg-slate-900"><option value="percentage">% da entrada</option><option value="fixed">Valor fixo</option></select><LocalizedNumberInput v-model="form.automaticValue" class="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-bold dark:border-emerald-900 dark:bg-slate-900" :placeholder="form.automaticMode === 'percentage' ? '10,00%' : '50,00'" /></div></section>

      <section class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/25"><label class="flex cursor-pointer items-start gap-3"><input v-model="form.monthlyEnabled" type="checkbox" class="mt-1 size-4 accent-amber-600" /><span><strong class="block text-sm">Guardar automaticamente todo mês</strong><span class="mt-1 block text-xs text-slate-500">Agenda a primeira reserva para o próximo dia escolhido. Ativar não transfere o valor agora.</span></span></label><div v-if="form.monthlyEnabled" class="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_90px]"><select v-model="form.monthlyMode" class="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-amber-900 dark:bg-slate-900"><option value="fixed">Valor fixo</option><option value="percentage">% do saldo</option></select><LocalizedNumberInput v-model="form.monthlyValue" class="rounded-xl border border-amber-200 bg-white px-3 py-2.5 font-bold dark:border-amber-900 dark:bg-slate-900" :placeholder="form.monthlyMode === 'percentage' ? '10,00%' : '50,00'" /><label class="grid gap-1 text-xs font-bold">Dia<input v-model.number="form.monthlyDay" type="number" min="1" max="28" class="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm dark:border-amber-900 dark:bg-slate-900" /></label></div></section>

      <div class="mt-5 flex items-center gap-3"><Landmark :size="18" /><p class="text-sm font-black">Cor e ícone</p></div>
      <div class="mt-2 flex flex-wrap gap-2"><button v-for="color in colors" :key="color" type="button" class="size-10 rounded-full border-4" :class="form.color === color ? 'border-slate-950 dark:border-white' : 'border-transparent'" :style="{ backgroundColor: color }" @click="form.color = color"></button><input v-model="form.emoji" maxlength="4" class="h-10 w-16 rounded-xl border border-slate-200 bg-transparent text-center text-xl dark:border-slate-700" aria-label="Emoji do cofre" /></div>

      <p v-if="error" class="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{{ error }}</p>
      <div class="pingo-modal-footer mt-6"><button class="btn min-h-12 w-full rounded-2xl border-0 bg-slate-950 font-black text-white dark:bg-amber-400 dark:text-slate-950">{{ form.transferNow ? 'Criar e transferir' : 'Criar porquinho vazio' }}</button></div>
  </AppModal>
</template>
