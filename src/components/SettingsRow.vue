<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

withDefaults(defineProps<{ label: string; description?: string; value?: string; clickable?: boolean; disabled?: boolean; danger?: boolean }>(), { description: '', value: '', clickable: false, disabled: false, danger: false })
const emit = defineEmits<{ activate: [] }>()
</script>

<template>
  <div class="group flex min-h-[3.65rem] w-full min-w-0 items-center gap-3 border-b border-line px-4 text-left last:border-b-0" :class="[clickable && !disabled ? 'cursor-pointer hover:bg-muted/70' : '', disabled ? 'opacity-45' : '', danger ? 'text-red-600' : '']" :role="clickable && !disabled ? 'button' : undefined" :tabindex="clickable && !disabled ? 0 : undefined" @click="clickable && !disabled && emit('activate')" @keydown.enter.prevent="clickable && !disabled && emit('activate')" @keydown.space.prevent="clickable && !disabled && emit('activate')">
    <slot name="icon" />
    <span class="min-w-0 flex-1 py-2.5"><strong class="block truncate text-sm font-semibold">{{ label }}</strong><span v-if="description" class="mt-0.5 block text-xs leading-snug text-subtle">{{ description }}</span></span>
    <slot name="control"><span v-if="value" class="max-w-[45%] truncate text-right text-sm text-subtle" :title="value">{{ value }}</span><ChevronRight v-if="clickable && !disabled" :size="17" class="shrink-0 text-subtle" /></slot>
  </div>
</template>
