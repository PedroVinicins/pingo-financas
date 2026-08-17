<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

defineProps<{ name: string }>()
const emit = defineEmits<{ edit: [] }>()
</script>

<template>
  <button class="pingo-card flex min-h-20 w-full min-w-0 items-center gap-4 p-4 text-left transition hover:bg-muted/40" @click="emit('edit')">
    <span class="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-extrabold uppercase text-brand">{{ name.slice(0, 1) }}</span>
    <span class="min-w-0 flex-1"><strong class="block truncate text-lg font-extrabold">{{ name }}</strong><span class="mt-0.5 block text-sm text-subtle">Toque para editar</span></span>
    <ChevronRight :size="19" class="shrink-0 text-subtle" />
  </button>
</template>
