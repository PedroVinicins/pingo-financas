<script setup lang="ts">
defineProps<{
  label: string
  value: string
  hint?: string
}>()
</script>

<template>
  <article class="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
    <p class="truncate text-sm font-medium text-slate-500 dark:text-slate-400" :title="label">{{ label }}</p>
    <p class="mt-2 truncate text-2xl font-black tracking-tight tabular-nums sm:text-3xl" :title="value">{{ value }}</p>
    <p v-if="hint" class="mt-2 truncate text-xs text-slate-500 dark:text-slate-400" :title="hint">{{ hint }}</p>
  </article>
</template>
