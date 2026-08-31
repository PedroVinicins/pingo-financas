<script setup lang="ts">
import { ref } from 'vue'
import { CircleDollarSign, Landmark, X } from 'lucide-vue-next'
import type { Vault } from '../types/finance'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import AppModal from './AppModal.vue'

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
  <AppModal as="form" aria-labelledby="vault-balance-title" root-class="z-[82]" panel-class="p-5 sm:max-w-md sm:p-6" @close="emit('close')" @submit="submit">
      <div class="flex min-w-0 items-start justify-between gap-3"><div class="flex min-w-0 gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950"><CircleDollarSign :size="22" /></div><div class="min-w-0"><p class="truncate text-sm font-bold text-amber-600">{{ vault.name }}</p><h2 id="vault-balance-title" class="break-words text-xl font-black">Pingou errado? Corrigir valor</h2></div></div><button type="button" class="pingo-modal-close" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></div>
      <p class="mt-4 text-sm leading-relaxed text-slate-500">Informe quanto existe de verdade no porquinho. O Pingo transfere apenas a diferença entre a conta principal e o porquinho, sem alterar seu patrimônio total.</p>
      <label class="mt-5 grid min-w-0 gap-1.5 text-sm font-bold">Saldo correto<LocalizedNumberInput v-model="balance" autofocus class="w-full min-w-0 max-w-full rounded-2xl border border-amber-200 bg-transparent px-4 py-4 text-3xl font-black dark:border-amber-900" placeholder="0,00" /></label>
      <p class="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Landmark :size="14" /> Disponível na conta: {{ availableBalance }}</p>
      <p v-if="error" class="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{{ error }}</p>
      <div class="pingo-modal-footer mt-5"><button class="btn min-h-12 w-full rounded-2xl border-0 bg-amber-400 font-black text-slate-950">Salvar saldo correto</button></div>
  </AppModal>
</template>
