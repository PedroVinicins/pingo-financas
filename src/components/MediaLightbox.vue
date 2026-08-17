<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Download, X } from 'lucide-vue-next'

const props = defineProps<{ src: string; title: string; fileName?: string | null }>()
const emit = defineEmits<{ close: [] }>()
let previousOverflow = ''

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => { document.body.style.overflow = previousOverflow })
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[150] grid bg-slate-950/95 p-3 backdrop-blur-xl sm:p-6" role="dialog" aria-modal="true" :aria-label="`Visualizando ${title}`" tabindex="-1" @click.self="emit('close')" @keydown.esc="emit('close')">
      <div class="flex min-w-0 items-center justify-between gap-3 text-white"><div class="min-w-0"><p class="text-xs font-black uppercase tracking-[.14em] text-violet-300">Carteira ao vivo</p><h2 class="truncate text-lg font-black" :title="title">{{ title }}</h2></div><div class="flex shrink-0 gap-2"><a :href="src" :download="fileName || title" class="grid size-11 place-items-center rounded-2xl bg-white/10" aria-label="Baixar imagem"><Download :size="19" /></a><button class="grid size-11 place-items-center rounded-2xl bg-white/10" aria-label="Fechar imagem" @click="emit('close')"><X :size="21" /></button></div></div>
      <div class="mt-3 grid min-h-0 place-items-center overflow-hidden rounded-[1.5rem] bg-black/30"><img :src="src" :alt="title" class="max-h-full max-w-full object-contain" /></div>
    </div>
  </Teleport>
</template>
