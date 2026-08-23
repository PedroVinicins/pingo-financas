<script setup lang="ts">
import { computed } from 'vue'
import { Lock, Star, Wifi } from 'lucide-vue-next'
import type { DebitCard } from '../types/finance'

const props = defineProps<{
  card: DebitCard
  compact?: boolean
}>()

const photoById = {
  amazonia: '/card-backgrounds/amazonia.svg',
  praia: '/card-backgrounds/praia.svg',
  cidade: '/card-backgrounds/cidade.svg',
  montanhas: '/card-backgrounds/montanhas.svg',
} as const

const patternStyle = computed(() => {
  const base = `linear-gradient(135deg, ${props.card.colorFrom}, ${props.card.colorTo})`
  if (props.card.pattern === 'dots') {
    return `radial-gradient(circle at 20% 20%, rgba(255,255,255,.22) 0 2px, transparent 2.5px), ${base}`
  }
  if (props.card.pattern === 'grid') {
    return `linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px), ${base}`
  }
  if (props.card.pattern === 'waves') {
    return `radial-gradient(ellipse at 15% 110%, transparent 0 36%, rgba(255,255,255,.14) 37% 43%, transparent 44% 55%, rgba(255,255,255,.08) 56% 63%, transparent 64%), ${base}`
  }
  if (props.card.pattern === 'aurora') {
    return `radial-gradient(circle at 20% 20%, rgba(255,255,255,.26), transparent 28%), radial-gradient(circle at 80% 70%, rgba(34,211,238,.28), transparent 32%), ${base}`
  }
  return base
})

const cardStyle = computed(() => {
  if (props.card.backgroundImage && props.card.backgroundImage !== 'none' && photoById[props.card.backgroundImage]) {
    return {
      backgroundColor: props.card.colorFrom,
      backgroundImage: `linear-gradient(120deg, ${props.card.colorFrom}D9, ${props.card.colorTo}66), url(${photoById[props.card.backgroundImage]})`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    }
  }
  return {
    background: patternStyle.value,
    backgroundSize: props.card.pattern === 'grid'
      ? '28px 28px, 28px 28px, auto'
      : props.card.pattern === 'dots' ? '18px 18px, auto' : 'auto',
  }
})

const networkLabel = computed(() => {
  switch (props.card.network) {
    case 'mastercard':
      return 'mastercard'
    case 'visa':
      return 'VISA'
    case 'elo':
      return 'elo'
    default:
      return 'DÉBITO'
  }
})
</script>

<template>
  <article
    class="relative isolate aspect-[1.586/1] w-full overflow-hidden rounded-[1.75rem] p-5 text-white shadow-2xl ring-1 ring-white/20 transition-all duration-300 sm:p-6"
    :class="compact ? 'max-w-[320px]' : 'max-w-[360px]'"
    :style="cardStyle"
  >
    <!-- Elementos Decorativos de Brilho -->
    <div class="absolute -right-12 -top-16 -z-10 size-48 rounded-full bg-white/10 blur-2xl"></div>
    <div class="absolute -bottom-20 -left-16 -z-10 size-56 rounded-full bg-black/15 blur-2xl"></div>

    <!-- Sticker / Emoji Embutido -->
    <div
      v-if="card.emoji"
      class="absolute right-5 top-14 rotate-6 text-5xl drop-shadow-lg transition-transform duration-300 hover:scale-110 sm:right-6 sm:top-16"
    >
      {{ card.emoji }}
    </div>

    <!-- Cabeçalho do Cartão -->
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 pr-8">
        <p class="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          {{ card.issuer || 'Banco' }}
        </p>
        <p class="mt-0.5 truncate text-lg font-black leading-tight">
          {{ card.name || 'Cartão sem nome' }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span
          v-if="card.isDefault"
          class="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur-md shadow-sm"
        >
          <Star :size="10" fill="currentColor" /> Principal
        </span>
        <Wifi :size="20" class="rotate-90 text-white/85" />
      </div>
    </div>

    <!-- Chip EMV do Cartão -->
    <div class="mt-5 h-8 w-11 rounded-lg bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 shadow-inner ring-1 ring-black/20"></div>

    <!-- Rodapé: Número / Nome / Bandeira -->
    <div class="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
      <div class="min-w-0">
        <p class="font-mono text-lg font-semibold tracking-[0.16em] sm:text-xl">
          •••• {{ card.lastFour }}
        </p>
        <p class="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {{ card.holderName }}
        </p>
      </div>
      <p class="shrink-0 text-sm font-black tracking-wider uppercase opacity-90">
        {{ networkLabel }}
      </p>
    </div>

    <!-- Overlay de Cartão Congelado -->
    <div
      v-if="card.isFrozen"
      class="absolute inset-0 grid place-items-center bg-slate-950/60 backdrop-blur-[2px] transition-all"
    >
      <div class="grid place-items-center text-center">
        <div class="grid size-11 place-items-center rounded-full bg-white/20 shadow-lg">
          <Lock :size="20" />
        </div>
        <p class="mt-2 text-xs font-black uppercase tracking-[0.16em]">Cartão congelado</p>
      </div>
    </div>
  </article>
</template>
