<script setup lang="ts">
import { Download, X } from 'lucide-vue-next'
import AppModal from './AppModal.vue'

const props = defineProps<{ src: string; title: string; fileName?: string | null }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <AppModal :aria-label="`Visualizando ${title}`" root-class="z-[150] !place-items-stretch !bg-slate-950/95 !p-3 backdrop-blur-xl sm:!p-6" panel-class="grid h-full !max-h-none !max-w-none grid-rows-[auto_minmax(0,1fr)] !overflow-hidden !rounded-none !border-0 !bg-transparent !p-0 !shadow-none" @close="emit('close')">
      <div class="flex min-w-0 items-center justify-between gap-3 text-white"><div class="min-w-0"><p class="text-xs font-black uppercase tracking-[.14em] text-violet-300">Carteira ao vivo</p><h2 class="truncate text-lg font-black" :title="title">{{ title }}</h2></div><div class="flex shrink-0 gap-2"><a :href="src" :download="fileName || title" class="btn btn-square min-h-11 rounded-2xl border-0 bg-white/10 text-white" aria-label="Baixar imagem"><Download :size="19" /></a><button class="btn btn-square min-h-11 rounded-2xl border-0 bg-white/10 text-white" aria-label="Fechar imagem" @click="emit('close')"><X :size="21" /></button></div></div>
      <div class="mt-3 grid min-h-0 place-items-center overflow-hidden rounded-[1.5rem] bg-black/30"><img :src="src" :alt="title" class="max-h-full max-w-full object-contain" /></div>
  </AppModal>
</template>
