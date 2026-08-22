<script setup lang="ts">
import { ref } from 'vue'
import { CircleDollarSign, Landmark, X } from 'lucide-vue-next'
import type { Vault } from '../types/finance'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'

const props = defineProps<{ vault: Vault; availableBalance: string }>()
const emit = defineEmits<{ close: []; save: [balance: string] }>()
const balance = ref(storageDecimalToLocalized(props.vault.balance))
const error = ref('')

function submit() {
  try {
    const normalized = localizedDecimalToStorage(balance.value)
    if (normalized === props.vault.balance) throw new Error('O saldo já está com esse valor.')
    emit('save', normalized)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Informe um saldo válido.' }
}
</script>

<template>
  <div class="fixed inset-0 z-[82] flex items-end bg-slate-950/60 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <form class="min-w-0 w-full max-w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex min-w-0 items-start justify-between gap-3"><div class="flex min-w-0 gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950"><CircleDollarSign :size="22" /></div><div class="min-w-0"><p class="truncate text-sm font-bold text-amber-600">{{ vault.name }}</p><h2 class="break-words text-xl font-black">Pingou errado? Corrigir valor</h2></div></div><button type="button" class="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></div>
      <p class="mt-4 text-sm leading-relaxed text-slate-500">Informe quanto existe de verdade no porquinho. O Pingo transfere apenas a diferença entre a conta principal e o porquinho, sem alterar seu patrimônio total.</p>
      <label class="mt-5 grid min-w-0 gap-1.5 text-sm font-bold">Saldo correto<LocalizedNumberInput v-model="balance" autofocus class="w-full min-w-0 max-w-full rounded-2xl border border-amber-200 bg-transparent px-4 py-4 text-3xl font-black dark:border-amber-900" placeholder="0,00" /></label>
      <p class="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Landmark :size="14" /> Disponível na conta: {{ availableBalance }}</p>
      <p v-if="error" class="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{{ error }}</p>
      <button class="mt-5 w-full rounded-2xl bg-amber-400 py-3.5 font-black text-slate-950">Salvar saldo correto</button>
    </form>
  </div>
</template>
