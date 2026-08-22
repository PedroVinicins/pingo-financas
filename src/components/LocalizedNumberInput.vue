<script setup lang="ts">
import { nextTick, ref, useAttrs } from 'vue'
import {
  completeLocalizedDecimalInput,
  formatLocalizedCurrencyInput,
} from '../services/localizedNumber'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: string
  decimalPlaces?: number
}>(), {
  decimalPlaces: 2,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const attrs = useAttrs()
const input = ref<HTMLInputElement | null>(null)

function focus() {
  input.value?.focus()
}

defineExpose({ focus })

function update(event: Event) {
  const target = event.target as HTMLInputElement
  const formatted = formatLocalizedCurrencyInput(target.value, props.decimalPlaces)
  target.value = formatted
  emit('update:modelValue', formatted)
  void nextTick(() => target.setSelectionRange(formatted.length, formatted.length))
}

function complete() {
  emit('update:modelValue', completeLocalizedDecimalInput(props.modelValue, props.decimalPlaces))
}
</script>

<template>
  <input
    ref="input"
    v-bind="attrs"
    :value="props.modelValue"
    inputmode="decimal"
    autocomplete="off"
    @input="update"
    @blur="complete"
  />
</template>
