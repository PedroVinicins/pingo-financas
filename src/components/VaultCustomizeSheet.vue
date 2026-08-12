<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Paintbrush, Sparkles, X } from 'lucide-vue-next'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import type { AutomaticReserveMode, AutomaticReserveRule, UpdateVaultInput, Vault } from '../types/finance'

const props = defineProps<{ vault: Vault; automaticRule: AutomaticReserveRule | null }>()
const emit = defineEmits<{ close: []; save: [vault: UpdateVaultInput, reserve: AutomaticReserveRule] }>()
const error = ref('')
const form = reactive({
  name: props.vault.name,
  institution: props.vault.institution,
  targetAmount: props.vault.targetAmount ? storageDecimalToLocalized(props.vault.targetAmount) : '',
  annualYieldRate: props.vault.annualYieldRate ? storageDecimalToLocalized(props.vault.annualYieldRate) : '',
  color: props.vault.color,
  emoji: props.vault.emoji ?? '🐷',
  automaticEnabled: props.automaticRule?.enabled ?? false,
  automaticMode: (props.automaticRule?.mode ?? 'percentage') as AutomaticReserveMode,
  automaticValue: props.automaticRule ? storageDecimalToLocalized(props.automaticRule.value) : '10,00',
})
const colors = ['#F97316', '#F43F5E', '#8B5CF6', '#0EA5E9', '#10B981', '#EAB308', '#0F172A']

function optionalDecimal(value: string) {
  return value.trim() ? localizedDecimalToStorage(value) : null
}
function submit() {
  error.value = ''
  try {
    const targetAmount = optionalDecimal(form.targetAmount)
    const annualYieldRate = optionalDecimal(form.annualYieldRate)
    const automaticValue = localizedDecimalToStorage(form.automaticValue)
    if (!form.name.trim() || !form.institution.trim()) throw new Error('Preencha nome e instituição.')
    if (form.automaticEnabled && Number(automaticValue) <= 0) throw new Error('Informe o valor da reserva automática.')
    if (form.automaticMode === 'percentage' && Number(automaticValue) > 100) throw new Error('A porcentagem máxima é 100%.')
    emit('save', {
      id: props.vault.id,
      name: form.name.trim(),
      institution: form.institution.trim(),
      targetAmount,
      annualYieldRate,
      color: form.color,
      emoji: form.emoji.trim() || null,
    }, {
      vaultId: props.vault.id,
      enabled: form.automaticEnabled,
      mode: form.automaticMode,
      value: automaticValue,
    })
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Confira os dados.' }
}
</script>

<template>
  <div class="fixed inset-0 z-[80] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <form class="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between"><div class="flex gap-3"><div class="grid size-11 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950"><Paintbrush :size="21" /></div><div><p class="text-sm font-bold text-amber-600">Do seu jeito</p><h2 class="text-xl font-black">Personalizar porquinho</h2></div></div><button type="button" class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button></div>

      <div class="mt-5 rounded-[1.75rem] p-5 text-white shadow-lg" :style="{ background: `linear-gradient(135deg, ${form.color}, ${form.color}B8)` }"><div class="flex items-center justify-between"><span class="text-4xl">{{ form.emoji || '🔐' }}</span><Sparkles :size="26" class="opacity-70" /></div><p class="mt-5 text-xs font-bold text-white/70">MEU COFRE</p><p class="mt-1 text-2xl font-black">{{ form.name || 'Meu porquinho' }}</p><p class="mt-1 text-sm font-semibold text-white/70">{{ form.institution || 'Minha instituição' }}</p></div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2"><label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Nome<input v-model="form.name" maxlength="50" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" /></label><label class="grid gap-1.5 text-sm font-bold sm:col-span-2">Banco / instituição<input v-model="form.institution" maxlength="60" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" /></label><label class="grid gap-1.5 text-sm font-bold">Meta<LocalizedNumberInput v-model="form.targetAmount" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Opcional" /></label><label class="grid gap-1.5 text-sm font-bold">Rendimento % a.a.<LocalizedNumberInput v-model="form.annualYieldRate" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" placeholder="Opcional" /></label></div>
      <div class="mt-5"><p class="text-sm font-black">Cor e carinha</p><div class="mt-2 flex flex-wrap gap-2"><button v-for="color in colors" :key="color" type="button" class="size-10 rounded-full border-4" :class="form.color === color ? 'border-slate-950 dark:border-white' : 'border-transparent'" :style="{ backgroundColor: color }" @click="form.color = color"></button><input v-model="form.emoji" maxlength="4" class="h-10 w-16 rounded-xl border border-slate-200 bg-transparent text-center text-xl dark:border-slate-700" /></div></div>

      <section class="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/25"><label class="flex cursor-pointer items-start gap-3"><input v-model="form.automaticEnabled" type="checkbox" class="mt-1 size-4 accent-emerald-600" /><span><strong class="block text-sm">Reserva automática</strong><span class="mt-1 block text-xs text-slate-500">Sempre que uma entrada cair, o Pingo separa uma parte neste cofre.</span></span></label><div v-if="form.automaticEnabled" class="mt-4 grid grid-cols-2 gap-2"><select v-model="form.automaticMode" class="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-emerald-900 dark:bg-slate-900"><option value="percentage">Percentual da entrada</option><option value="fixed">Valor fixo</option></select><LocalizedNumberInput v-model="form.automaticValue" class="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-bold dark:border-emerald-900 dark:bg-slate-900" :placeholder="form.automaticMode === 'percentage' ? '10,00%' : '50,00'" /></div></section>
      <p v-if="error" class="mt-3 text-sm font-bold text-rose-600">{{ error }}</p>
      <button class="mt-5 w-full rounded-2xl bg-amber-400 py-3.5 font-black text-slate-950">Salvar personalização</button>
    </form>
  </div>
</template>
