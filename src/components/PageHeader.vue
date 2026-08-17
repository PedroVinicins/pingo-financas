<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

withDefaults(defineProps<{ eyebrow?: string; title: string; description?: string; addLabel?: string }>(), { eyebrow: '', description: '', addLabel: '' })
const emit = defineEmits<{ add: [] }>()
</script>

<template>
  <header class="flex min-w-0 items-end justify-between gap-4">
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-sm font-semibold text-brand">{{ eyebrow }}</p>
      <h1 class="truncate text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold tracking-[-0.035em]">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-2xl text-sm text-subtle">{{ description }}</p>
    </div>
    <button v-if="addLabel" class="pingo-interactive hidden min-h-11 shrink-0 items-center gap-2 rounded-2xl bg-brand px-4 text-sm font-bold text-white sm:flex" @click="emit('add')"><Plus :size="18" /> {{ addLabel }}</button>
    <slot />
  </header>
</template>
