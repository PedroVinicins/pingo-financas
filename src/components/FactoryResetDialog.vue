<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import AppModal from './AppModal.vue'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const confirmation = ref('')
const allowed = computed(() => confirmation.value.trim().toLocaleUpperCase('pt-BR') === 'APAGAR')
</script>

<template>
  <AppModal role="alertdialog" aria-labelledby="factory-reset-title" root-class="z-[120]" panel-class="p-5 sm:max-w-md sm:p-6" :closeable="!busy" @close="emit('cancel')">
        <div class="flex items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950"><AlertTriangle :size="22" /></div><div class="min-w-0 flex-1"><h2 id="factory-reset-title" class="text-xl font-black">Apagar todo o Pingo?</h2><p class="mt-1 text-sm leading-relaxed text-slate-500">Esta ação apaga permanentemente transações, saldos, categorias criadas, cartões, documentos, porquinhos, automações, alertas e personalizações deste dispositivo.</p></div><button :disabled="busy" class="pingo-modal-close" aria-label="Cancelar" @click="emit('cancel')"><X :size="18" /></button></div>
        <p class="mt-5 text-sm font-bold">Digite <strong class="text-rose-600">APAGAR</strong> para confirmar:</p><input v-model="confirmation" :disabled="busy" autocomplete="off" class="mt-2 h-12 w-full rounded-xl border border-rose-300 bg-transparent px-3 font-black uppercase outline-none focus:ring-2 focus:ring-rose-300 dark:border-rose-900" placeholder="APAGAR" />
        <div class="pingo-modal-footer mt-5 grid grid-cols-2 gap-2"><button :disabled="busy" class="pingo-modal-secondary" @click="emit('cancel')">Cancelar</button><button :disabled="busy || !allowed" class="btn min-h-12 rounded-2xl border-0 text-sm font-black text-white" :class="allowed && !busy ? 'cursor-pointer bg-rose-500 shadow-lg shadow-rose-500/20 hover:bg-rose-400 active:bg-rose-600' : 'cursor-not-allowed bg-rose-900/60 text-white/60'" @click="emit('confirm')">{{ busy ? 'Apagando…' : 'Apagar tudo' }}</button></div>
  </AppModal>
</template>
