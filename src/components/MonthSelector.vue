<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const props = defineProps<{ year: number; month: number }>()
const emit = defineEmits<{ change: [year: number, month: number] }>()
const open = ref(false)
const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const label = computed(() => months[props.month - 1] ?? '')

function select(month: number) { emit('change', props.year, month); open.value = false }
function moveYear(offset: number) { emit('change', props.year + offset, props.month) }
</script>

<template>
  <div class="relative" data-no-page-swipe>
    <button class="pingo-interactive flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-4 text-xs font-extrabold tracking-[0.08em]" :aria-expanded="open" aria-haspopup="dialog" @click="open = !open">{{ label }} <ChevronDown :size="14" /></button>
    <Transition enter-active-class="transition duration-200 ease-pingo" enter-from-class="-translate-y-2 opacity-0" leave-active-class="transition duration-150" leave-to-class="-translate-y-2 opacity-0">
      <section v-if="open" class="absolute right-0 top-12 z-50 w-[280px] rounded-[1.5rem] border border-line bg-surface p-3 shadow-float" aria-label="Selecionar mês e ano">
        <div class="flex items-center justify-between">
          <button class="grid size-11 place-items-center rounded-xl hover:bg-muted" aria-label="Ano anterior" @click="moveYear(-1)"><ChevronLeft :size="18" /></button>
          <strong>{{ year }}</strong>
          <button class="grid size-11 place-items-center rounded-xl hover:bg-muted" aria-label="Próximo ano" @click="moveYear(1)"><ChevronRight :size="18" /></button>
        </div>
        <div class="mt-1 grid grid-cols-4 gap-1">
          <button v-for="(name, index) in months" :key="name" class="min-h-11 rounded-xl text-xs font-bold" :class="month === index + 1 ? 'bg-brand text-white' : 'text-subtle hover:bg-muted hover:text-ink'" @click="select(index + 1)">{{ name }}</button>
        </div>
      </section>
    </Transition>
  </div>
</template>
