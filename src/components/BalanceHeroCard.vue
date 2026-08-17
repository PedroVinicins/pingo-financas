<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

withDefaults(defineProps<{
  balance: string
  month: string
  income: string
  expense: string
  netWorth?: string
  hidden?: boolean
  budgetProgress?: number | null
}>(), { netWorth: '', hidden: false, budgetProgress: null })
const emit = defineEmits<{ details: []; togglePrivacy: [] }>()
</script>

<template>
  <article class="relative min-h-[310px] overflow-hidden rounded-[2rem] bg-hero p-6 text-white shadow-float sm:p-8 lg:min-h-[330px]">
    <div class="absolute -right-20 -top-20 size-64 rounded-full bg-brand/10 blur-3xl"></div>
    <div class="relative flex items-start justify-between gap-3">
      <div><p class="text-sm font-semibold text-white/65">Saldo disponível</p><p class="mt-1 text-xs font-bold uppercase tracking-[.12em] text-white/35">{{ month }}</p></div>
      <button class="grid size-11 place-items-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white" :aria-label="hidden ? 'Mostrar valores' : 'Ocultar valores'" @click="emit('togglePrivacy')"><Eye v-if="hidden" :size="19" /><EyeOff v-else :size="19" /></button>
    </div>
    <h2 class="relative mt-7 truncate text-[clamp(2.65rem,10vw,4.5rem)] font-extrabold leading-none tracking-[-0.065em] tabular-nums" :title="balance">{{ balance }}</h2>
    <div class="relative mt-7 h-1.5 overflow-hidden rounded-full bg-white/12">
      <div v-if="budgetProgress !== null" class="h-full rounded-full bg-brand transition-[width] duration-500 ease-pingo" :style="{ width: `${Math.min(100, Math.max(0, budgetProgress))}%` }"></div>
      <div v-else class="h-full w-12 rounded-full bg-white/25"></div>
    </div>
    <p class="relative mt-2 text-[11px] font-medium text-white/40">{{ budgetProgress === null ? 'Defina um limite mensal nos Ajustes' : `${budgetProgress.toFixed(0)}% do limite mensal utilizado` }}</p>
    <div class="relative mt-6 grid grid-cols-2 gap-4">
      <div class="min-w-0"><p class="text-xs text-white/45">Entradas</p><strong class="mt-1 block truncate text-base tabular-nums sm:text-lg" :title="income">{{ income }}</strong></div>
      <div class="min-w-0 text-right"><p class="text-xs text-white/45">Saídas</p><strong class="mt-1 block truncate text-base tabular-nums sm:text-lg" :title="expense">{{ expense }}</strong></div>
    </div>
    <div v-if="netWorth" class="relative mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs"><span class="text-white/45">Patrimônio total</span><strong class="truncate tabular-nums" :title="netWorth">{{ netWorth }}</strong></div>
    <button class="absolute -bottom-0 left-1/2 min-h-11 -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-full bg-white px-6 text-sm font-bold text-[#171719] shadow-lg transition hover:px-7 active:scale-[.98]" @click="emit('details')">Ver detalhes</button>
  </article>
</template>
