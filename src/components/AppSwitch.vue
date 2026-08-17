<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button type="button" role="switch" :aria-label="label" :aria-checked="modelValue" :disabled="disabled" class="relative h-7 w-12 shrink-0 rounded-full transition duration-200 ease-pingo disabled:opacity-40" :class="modelValue ? 'bg-brand' : 'bg-[#D1D1D8] dark:bg-[#4A4A55]'" @click.stop="emit('update:modelValue', !modelValue)"><span class="absolute top-1 size-5 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-pingo" :class="modelValue ? 'left-6' : 'left-1'"></span></button>
</template>
