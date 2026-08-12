<script setup lang="ts">
import { ref, useAttrs } from 'vue'
import {
  completeLocalizedDecimalInput,
  formatLocalizedDecimalInput,
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
  const input = event.target as HTMLInputElement
  emit('update:modelValue', formatLocalizedDecimalInput(input.value, props.decimalPlaces))
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
