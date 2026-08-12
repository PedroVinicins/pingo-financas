<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-vue-next'
import type { MoveVaultMoneyInput, Vault, VaultMovementType } from '../types/finance'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'

const props = defineProps<{ vault: Vault; initialKind?: VaultMovementType; availableBalance: string }>()
const emit = defineEmits<{ close: []; save: [input: MoveVaultMoneyInput] }>()
const kind = ref<VaultMovementType>(props.initialKind ?? 'deposit')
const amount = ref('')
const error = ref('')
const title = computed(() => kind.value === 'deposit' ? 'Guardar dinheiro' : 'Retirar do cofre')

function submit() {
  let normalized: string
  try {
    normalized = localizedDecimalToStorage(amount.value)
  } catch {
    error.value = 'Informe um valor válido.'
    return
  }
  if (Number(normalized) <= 0) { error.value = 'Informe um valor maior que zero.'; return }
  emit('save', { id: props.vault.id, kind: kind.value, amount: normalized })
}
</script>

<template>
  <div class="fixed inset-0 z-[75] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <form class="w-full rounded-t-[2rem] bg-white p-5 dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between"><div><p class="text-sm font-bold text-amber-600">{{ vault.name }}</p><h2 class="text-2xl font-black">{{ title }}</h2></div><button type="button" class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button></div>
      <div class="mt-5 grid grid-cols-2 gap-2"><button type="button" class="flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold" :class="kind === 'deposit' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'" @click="kind = 'deposit'"><ArrowDownToLine :size="17" /> Guardar</button><button type="button" class="flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold" :class="kind === 'withdraw' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40' : 'border-slate-200 dark:border-slate-700'" @click="kind = 'withdraw'"><ArrowUpFromLine :size="17" /> Retirar</button></div>
      <label class="mt-5 grid gap-1.5 text-sm font-semibold">Valor<LocalizedNumberInput v-model="amount" autofocus placeholder="0,00" class="rounded-2xl border border-slate-200 bg-transparent px-4 py-4 text-3xl font-black dark:border-slate-700" /></label>
      <div class="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950">
        <strong class="block text-slate-700 dark:text-slate-200">{{ kind === 'deposit' ? 'Conta principal → Porquinho' : 'Porquinho → Conta principal' }}</strong>
        <span v-if="kind === 'deposit'">Disponível na conta: {{ availableBalance }}</span>
        <span v-else>O valor retirado volta para o saldo disponível.</span>
      </div>
      <p v-if="error" class="mt-3 text-sm font-bold text-rose-600">{{ error }}</p>
      <button class="mt-5 w-full rounded-2xl bg-amber-400 py-3.5 font-black text-slate-950">Confirmar</button>
    </form>
  </div>
</template>
