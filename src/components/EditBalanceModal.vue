<script setup lang="ts">
import { ref } from 'vue'
import { Landmark, ShieldCheck, X } from 'lucide-vue-next'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import AppModal from './AppModal.vue'

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
  <AppModal as="form" aria-labelledby="edit-balance-title" root-class="z-[85]" panel-class="p-5 sm:max-w-md sm:p-6" @close="emit('close')" @submit="submit">
      <div class="flex min-w-0 items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950"><Landmark :size="21" /></div><div class="min-w-0"><p class="text-sm font-bold text-emerald-600">Correção segura</p><h2 id="edit-balance-title" class="break-words text-xl font-black">Editar saldo da conta</h2></div></div>
        <button type="button" class="pingo-modal-close" aria-label="Fechar" @click="emit('close')"><X :size="19" /></button>
      </div>
      <p class="mt-4 text-sm leading-relaxed text-slate-500">Informe quanto existe na conta principal, fora dos porquinhos. O histórico de compras não será apagado.</p>
      <label class="mt-5 grid min-w-0 gap-1.5 text-sm font-bold">Saldo correto<LocalizedNumberInput v-model="amount" autofocus class="w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-4 text-3xl font-black dark:border-slate-700" placeholder="0,00" /></label>
      <div class="mt-4 flex gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950"><ShieldCheck :size="17" class="shrink-0 text-emerald-600" /><p>O Pingo cria um ajuste de conferência. Entradas, despesas e valores guardados continuam intactos.</p></div>
      <p v-if="error" class="mt-3 text-sm font-bold text-rose-600">{{ error }}</p>
      <div class="pingo-modal-footer mt-5"><button class="btn min-h-12 w-full rounded-2xl border-0 bg-emerald-400 font-black text-slate-950">Salvar saldo correto</button></div>
  </AppModal>
</template>
