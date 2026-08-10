<script setup lang="ts">
defineProps<{
  label: string
  value: string
  hint?: string
}>()
</script>

<template>
  <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
    <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ label }}</p>
    <p class="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{{ value }}</p>
    <p v-if="hint" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </article>
</template>
