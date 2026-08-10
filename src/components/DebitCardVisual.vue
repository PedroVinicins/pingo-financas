<script setup lang="ts">
import { computed } from 'vue'
import { Lock, Star, Wifi } from 'lucide-vue-next'
import type { DebitCard } from '../types/finance'

const props = defineProps<{ card: DebitCard; compact?: boolean }>()

const patternStyle = computed(() => {
  const base = `linear-gradient(135deg, ${props.card.colorFrom}, ${props.card.colorTo})`
  if (props.card.pattern === 'dots') return `${'radial-gradient(circle at 20% 20%, rgba(255,255,255,.22) 0 2px, transparent 2.5px)'}, ${base}`
  if (props.card.pattern === 'grid') return `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), ${base}`
  if (props.card.pattern === 'waves') return `radial-gradient(ellipse at 15% 110%, transparent 0 36%, rgba(255,255,255,.14) 37% 43%, transparent 44% 55%, rgba(255,255,255,.08) 56% 63%, transparent 64%), ${base}`
  if (props.card.pattern === 'aurora') return `radial-gradient(circle at 20% 20%, rgba(255,255,255,.26), transparent 28%), radial-gradient(circle at 80% 70%, rgba(34,211,238,.28), transparent 32%), ${base}`
  return base
})

function networkLabel() {
  if (props.card.network === 'mastercard') return 'mastercard'
  if (props.card.network === 'visa') return 'VISA'
  if (props.card.network === 'elo') return 'elo'
  return 'DEBIT'
}
</script>

<template>
  <article
    class="relative isolate aspect-[1.586/1] w-full overflow-hidden rounded-[1.75rem] p-5 text-white shadow-2xl ring-1 ring-white/20 transition sm:p-6"
    :class="compact ? 'max-w-[320px]' : 'max-w-[360px]'"
    :style="{ background: patternStyle, backgroundSize: card.pattern === 'grid' ? '28px 28px, 28px 28px, auto' : card.pattern === 'dots' ? '18px 18px, auto' : 'auto' }"
  >
    <div class="absolute -right-12 -top-16 -z-10 size-48 rounded-full bg-white/10 blur-2xl"></div>
    <div class="absolute -bottom-20 -left-16 -z-10 size-56 rounded-full bg-black/15 blur-2xl"></div>
    <div v-if="card.emoji" class="absolute right-5 top-14 rotate-6 text-5xl drop-shadow-lg sm:right-6 sm:top-16">{{ card.emoji }}</div>

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{{ card.issuer }}</p>
        <p class="mt-1 truncate text-lg font-black">{{ card.name }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="card.isDefault" class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold backdrop-blur"><Star :size="11" fill="currentColor" /> Principal</span>
        <Wifi :size="22" class="rotate-90 text-white/85" />
      </div>
    </div>

    <div class="mt-6 h-8 w-11 rounded-lg bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 shadow-inner ring-1 ring-black/10"></div>

    <div class="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
      <div class="min-w-0"><p class="font-mono text-lg font-semibold tracking-[0.16em] sm:text-xl">•••• {{ card.lastFour }}</p><p class="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">{{ card.holderName }}</p></div>
      <p class="shrink-0 text-sm font-black tracking-tight">{{ networkLabel() }}</p>
    </div>

    <div v-if="card.isFrozen" class="absolute inset-0 grid place-items-center bg-slate-950/55 backdrop-blur-[2px]"><div class="grid place-items-center text-center"><div class="grid size-11 place-items-center rounded-full bg-white/15"><Lock :size="20" /></div><p class="mt-2 text-xs font-black uppercase tracking-[0.16em]">Congelado</p></div></div>
  </article>
</template>
