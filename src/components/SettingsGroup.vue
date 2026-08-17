<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section>
    <h2 class="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-subtle">{{ title }}</h2>
    <div class="overflow-hidden rounded-pingo border border-line bg-surface shadow-card"><slot /></div>
  </section>
</template>
