<script setup lang="ts">
import { ref } from 'vue'
import { Landmark, ShieldCheck, X } from 'lucide-vue-next'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'

const props = defineProps<{ currentBalance: string }>()
const emit = defineEmits<{ close: []; save: [amount: string] }>()
const amount = ref(storageDecimalToLocalized(props.currentBalance))
const error = ref('')

function submit() {
  try {
    emit('save', localizedDecimalToStorage(amount.value))
  } catch {
    error.value = 'Informe um saldo válido.'
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[85] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <form class="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3"><div class="grid size-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950"><Landmark :size="21" /></div><div><p class="text-sm font-bold text-emerald-600">Correção segura</p><h2 class="text-xl font-black">Editar saldo da conta</h2></div></div>
        <button type="button" class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button>
      </div>
      <p class="mt-4 text-sm leading-relaxed text-slate-500">Informe quanto existe na conta principal, fora dos porquinhos. O histórico de compras não será apagado.</p>
      <label class="mt-5 grid gap-1.5 text-sm font-bold">Saldo correto<LocalizedNumberInput v-model="amount" autofocus class="rounded-2xl border border-slate-200 bg-transparent px-4 py-4 text-3xl font-black dark:border-slate-700" placeholder="0,00" /></label>
      <div class="mt-4 flex gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950"><ShieldCheck :size="17" class="shrink-0 text-emerald-600" /><p>O Pingo cria um ajuste de conferência. Entradas, despesas e valores guardados continuam intactos.</p></div>
      <p v-if="error" class="mt-3 text-sm font-bold text-rose-600">{{ error }}</p>
      <button class="mt-5 w-full rounded-2xl bg-emerald-400 py-3.5 font-black text-slate-950">Salvar saldo correto</button>
    </form>
  </div>
</template>
