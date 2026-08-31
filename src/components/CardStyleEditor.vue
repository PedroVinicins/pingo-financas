<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Image, Palette, X } from 'lucide-vue-next'
import DebitCardVisual from './DebitCardVisual.vue'
import AppModal from './AppModal.vue'
import type { CardBackground, CardPattern, DebitCard, UpdateDebitCardStyleInput } from '../types/finance'

const props = defineProps<{ card: DebitCard }>()
const emit = defineEmits<{ close: []; save: [input: UpdateDebitCardStyleInput] }>()

const palettes = [
  ['Noite', '#020617', '#334155'], ['Açaí', '#581C87', '#BE185D'], ['Amazônia', '#064E3B', '#10B981'],
  ['Oceano', '#0C4A6E', '#2563EB'], ['Manga', '#EA580C', '#F59E0B'], ['Neon', '#312E81', '#06B6D4'],
]
const patterns: { id: CardPattern; label: string }[] = [
  { id: 'soft', label: 'Suave' }, { id: 'waves', label: 'Ondas' }, { id: 'dots', label: 'Pontos' }, { id: 'grid', label: 'Grade' }, { id: 'aurora', label: 'Aurora' },
]
const backgrounds: { id: CardBackground; label: string }[] = [
  { id: 'none', label: 'Sem foto' }, { id: 'amazonia', label: 'Amazônia' },
  { id: 'praia', label: 'Praia' }, { id: 'cidade', label: 'Cidade' },
  { id: 'montanhas', label: 'Montanhas' },
]
const emojis = ['', '💸', '🍊', '🎮', '🚀', '🌴', '🧠', '💜', '⚡', '🐸']
const form = reactive({ colorFrom: props.card.colorFrom, colorTo: props.card.colorTo, pattern: props.card.pattern, backgroundImage: props.card.backgroundImage, emoji: props.card.emoji ?? '' })
const preview = computed<DebitCard>(() => ({ ...props.card, ...form, emoji: form.emoji || null }))

function usePalette(from: string, to: string) { form.colorFrom = from; form.colorTo = to }
function submit() { emit('save', { id: props.card.id, colorFrom: form.colorFrom, colorTo: form.colorTo, pattern: form.pattern, backgroundImage: form.backgroundImage, emoji: form.emoji || null }) }
</script>

<template>
  <AppModal as="form" aria-labelledby="card-style-title" root-class="z-[75]" panel-class="p-5 sm:max-w-xl" @close="emit('close')" @submit="submit">
      <div class="flex items-center justify-between gap-3"><div class="min-w-0"><p class="text-sm font-bold text-violet-600">Personalização</p><h2 id="card-style-title" class="break-words text-2xl font-black">Deixe o cartão com a sua cara</h2></div><button type="button" class="pingo-modal-close" aria-label="Fechar" @click="emit('close')"><X :size="19" /></button></div>
      <div class="mx-auto mt-5 max-w-[360px]"><DebitCardVisual :card="preview" /></div>

      <p class="mt-6 text-sm font-black">Cores</p>
      <div class="mt-2 grid grid-cols-3 gap-2">
        <button v-for="palette in palettes" :key="palette[0]" type="button" class="rounded-2xl border border-slate-200 p-2 text-xs font-bold dark:border-slate-700" @click="usePalette(palette[1], palette[2])"><span class="mb-1 block h-8 rounded-xl" :style="{ background: `linear-gradient(135deg, ${palette[1]}, ${palette[2]})` }"></span>{{ palette[0] }}</button>
      </div>

      <p class="mt-5 text-sm font-black">Textura</p>
      <div class="mt-2 flex flex-wrap gap-2"><button v-for="pattern in patterns" :key="pattern.id" type="button" class="rounded-xl border px-3 py-2 text-xs font-bold" :class="form.pattern === pattern.id ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-200 dark:border-slate-700'" @click="form.pattern = pattern.id">{{ pattern.label }}</button></div>

      <p class="mt-5 flex items-center gap-2 text-sm font-black"><Image :size="16" /> Foto de fundo</p>
      <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <button v-for="background in backgrounds" :key="background.id" type="button" class="overflow-hidden rounded-xl border text-[11px] font-bold" :class="form.backgroundImage === background.id ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200 dark:border-slate-700'" @click="form.backgroundImage = background.id">
          <span class="block h-12 bg-slate-100 bg-cover bg-center dark:bg-slate-800" :style="background.id === 'none' ? {} : { backgroundImage: `url(/card-backgrounds/${background.id}.svg)` }"></span>
          <span class="block px-1 py-2">{{ background.label }}</span>
        </button>
      </div>

      <p class="mt-5 text-sm font-black">Sticker</p>
      <div class="mt-2 grid grid-cols-5 gap-2"><button v-for="emoji in emojis" :key="emoji || 'none'" type="button" class="grid h-12 place-items-center rounded-2xl border text-xl" :class="form.emoji === emoji ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-slate-200 dark:border-slate-700'" @click="form.emoji = emoji">{{ emoji || '—' }}</button></div>

      <div class="pingo-modal-footer mt-6"><button class="btn min-h-14 w-full rounded-full border-0 bg-brand font-black text-white"><Palette :size="18" /> Salvar aparência</button></div>
  </AppModal>
</template>
