<script setup lang="ts">
import { computed } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  balance: string
  month: string
  income: string
  expense: string
  netWorth?: string
  hidden?: boolean
  budgetProgress?: number | null
}>(), { netWorth: '', hidden: false, budgetProgress: null })
const emit = defineEmits<{ details: []; togglePrivacy: [] }>()

const balanceSize = computed(() => {
  const length = [...props.balance].length
  if (length <= 9) return 'clamp(2.65rem, 10vw, 4rem)'
  if (length <= 13) return 'clamp(2rem, 8vw, 3.4rem)'
  if (length <= 17) return 'clamp(1.65rem, 6.5vw, 2.8rem)'
  return 'clamp(1.35rem, 5.25vw, 2.3rem)'
})
</script>

<template>
  <article class="hero-shadow relative min-h-[310px] overflow-visible rounded-[30px] bg-hero p-6 text-white sm:p-8 lg:min-h-[330px]">
    <div class="relative flex items-center justify-between gap-3 text-sm">
      <p class="font-medium text-white/65">Saldo disponível</p>
      <p class="text-xs font-bold uppercase tracking-[.12em] text-white/45">{{ month }}</p>
    </div>
    <div class="relative mt-8 flex min-w-0 items-center gap-2">
      <h2 class="min-w-0 flex-1 whitespace-nowrap pr-1 font-extrabold leading-none tracking-[-0.045em] tabular-nums" :style="{ fontSize: balanceSize }" :title="balance">{{ balance }}</h2>
      <button class="grid size-10 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white" :aria-label="hidden ? 'Mostrar valores' : 'Ocultar valores'" @click="emit('togglePrivacy')"><Eye v-if="hidden" :size="19" /><EyeOff v-else :size="19" /></button>
    </div>
    <div class="relative mt-7 h-1.5 overflow-hidden rounded-full bg-white/12">
      <div v-if="budgetProgress !== null" class="h-full rounded-full bg-brand transition-[width] duration-500 ease-pingo" :style="{ width: `${Math.min(100, Math.max(0, budgetProgress))}%` }"></div>
      <div v-else class="h-full w-12 rounded-full bg-white/25"></div>
    </div>
    <p class="relative mt-2 text-[11px] font-medium text-white/40">{{ budgetProgress === null ? 'Defina um limite mensal nos Ajustes' : `${budgetProgress.toFixed(0)}% do limite mensal utilizado` }}</p>
    <div class="relative mt-6 flex gap-8 sm:gap-12">
      <div class="min-w-0"><p class="text-xs text-white/45">Entradas</p><strong class="mt-1 block truncate text-base tabular-nums sm:text-lg" :title="income">{{ income }}</strong></div>
      <div class="min-w-0"><p class="text-xs text-white/45">Saídas</p><strong class="mt-1 block truncate text-base tabular-nums sm:text-lg" :title="expense">{{ expense }}</strong></div>
    </div>
    <div v-if="netWorth" class="relative mt-4 flex min-w-0 items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs"><span class="text-white/45">Patrimônio total</span><strong class="truncate tabular-nums" :title="netWorth">{{ netWorth }}</strong></div>
    <button class="absolute -bottom-5 left-6 min-h-11 whitespace-nowrap rounded-full bg-white px-5 text-sm font-bold text-[#171719] shadow-lg transition hover:px-6 active:scale-[.97] sm:left-8" @click="emit('details')">Ver detalhes&nbsp; ↗</button>
  </article>
</template>
