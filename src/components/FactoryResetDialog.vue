<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const confirmation = ref('')
const allowed = computed(() => confirmation.value.trim().toLocaleUpperCase('pt-BR') === 'APAGAR')
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[120] grid place-items-end bg-slate-950/65 backdrop-blur-[2px] sm:place-items-center sm:p-4" @click.self="!busy && emit('cancel')">
      <section class="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="factory-reset-title">
        <div class="flex items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950"><AlertTriangle :size="22" /></div><div class="min-w-0 flex-1"><h2 id="factory-reset-title" class="text-xl font-black">Apagar todo o Pingo?</h2><p class="mt-1 text-sm leading-relaxed text-slate-500">Esta ação apaga permanentemente transações, saldos, categorias criadas, cartões, documentos, porquinhos, automações, alertas e personalizações deste dispositivo.</p></div><button :disabled="busy" class="grid size-9 place-items-center text-slate-400 disabled:opacity-40" aria-label="Cancelar" @click="emit('cancel')"><X :size="18" /></button></div>
        <p class="mt-5 text-sm font-bold">Digite <strong class="text-rose-600">APAGAR</strong> para confirmar:</p><input v-model="confirmation" :disabled="busy" autocomplete="off" class="mt-2 h-12 w-full rounded-xl border border-rose-300 bg-transparent px-3 font-black uppercase outline-none focus:ring-2 focus:ring-rose-300 dark:border-rose-900" placeholder="APAGAR" />
        <div class="mt-5 grid grid-cols-2 gap-2"><button :disabled="busy" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black dark:border-slate-700" @click="emit('cancel')">Cancelar</button><button :disabled="busy || !allowed" class="rounded-2xl px-4 py-3 text-sm font-black text-white transition" :class="allowed && !busy ? 'cursor-pointer bg-rose-500 shadow-lg shadow-rose-500/20 hover:bg-rose-400 active:bg-rose-600' : 'cursor-not-allowed bg-rose-900/60 text-white/60'" @click="emit('confirm')">{{ busy ? 'Apagando…' : 'Apagar tudo' }}</button></div>
      </section>
    </div>
  </Teleport>
</template>
