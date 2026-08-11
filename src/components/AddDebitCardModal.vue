<script setup lang="ts">
import { computed, reactive } from 'vue'
import { ShieldCheck, X } from 'lucide-vue-next'
import type { CardBackground, CardNetwork, CardPattern, NewDebitCardInput } from '../types/finance'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'

const props = defineProps<{ existingCardsCount: number }>()
const emit = defineEmits<{
  close: []
  save: [input: NewDebitCardInput]
}>()

const palettes = [
  { name: 'Grafite', from: '#0F172A', to: '#334155' },
  { name: 'Laranja', from: '#F97316', to: '#C2410C' },
  { name: 'Esmeralda', from: '#059669', to: '#065F46' },
  { name: 'Azul', from: '#2563EB', to: '#1E3A8A' },
  { name: 'Violeta', from: '#7C3AED', to: '#4C1D95' },
]

const backgrounds: { id: CardBackground; label: string }[] = [
  { id: 'none', label: 'Sem foto' },
  { id: 'amazonia', label: 'Amazônia' },
  { id: 'praia', label: 'Praia' },
  { id: 'cidade', label: 'Cidade' },
  { id: 'montanhas', label: 'Montanhas' },
]

const form = reactive({
  name: 'Cartão principal',
  issuer: '',
  holderName: '',
  lastFour: '',
  network: 'mastercard' as CardNetwork,
  palette: 0,
  monthlySpendingLimit: '',
  pattern: 'soft' as CardPattern,
  backgroundImage: 'none' as CardBackground,
  emoji: '',
  isDefault: props.existingCardsCount === 0,
})

const selectedPalette = computed(() => palettes[form.palette])

function submit() {
  const lastFour = form.lastFour.replace(/\D/g, '')
  if (!form.name.trim() || !form.issuer.trim() || !form.holderName.trim()) return
  if (!/^\d{4}$/.test(lastFour)) return

  let limit = ''
  if (form.monthlySpendingLimit.trim()) {
    try {
      limit = localizedDecimalToStorage(form.monthlySpendingLimit)
    } catch {
      return
    }
    if (Number(limit) <= 0) return
  }

  emit('save', {
    name: form.name.trim(),
    issuer: form.issuer.trim(),
    holderName: form.holderName.trim(),
    lastFour,
    network: form.network,
    colorFrom: selectedPalette.value.from,
    colorTo: selectedPalette.value.to,
    pattern: form.pattern,
    backgroundImage: form.backgroundImage,
    emoji: form.emoji || null,
    isDefault: form.isDefault,
    monthlySpendingLimit: limit || null,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 sm:place-items-center sm:p-4" @click.self="emit('close')">
    <form class="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-xl sm:rounded-[2rem] sm:p-6" @submit.prevent="submit">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-bold text-emerald-600">Carteira</p>
          <h2 class="text-2xl font-black tracking-tight">Adicionar cartão de débito</h2>
        </div>
        <button type="button" class="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
        <ShieldCheck :size="20" class="mt-0.5 shrink-0" />
        <p><strong>Privacidade:</strong> informe somente os 4 últimos dígitos. O app não precisa de número completo, validade ou CVV.</p>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold">
          Apelido do cartão
          <input v-model="form.name" maxlength="40" placeholder="Ex.: Inter principal" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Banco / emissor
          <input v-model="form.issuer" maxlength="60" placeholder="Ex.: Banco Inter" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Nome do titular
          <input v-model="form.holderName" maxlength="80" placeholder="Como você quer mostrar no cartão" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 uppercase dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Últimos 4 dígitos
          <input v-model="form.lastFour" inputmode="numeric" maxlength="4" placeholder="4242" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 font-mono tracking-[0.2em] dark:border-slate-700" />
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Bandeira
          <select v-model="form.network" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="mastercard">Mastercard</option>
            <option value="visa">Visa</option>
            <option value="elo">Elo</option>
            <option value="other">Outra</option>
          </select>
        </label>
        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Limite mensal de controle <span class="font-normal text-slate-400">(opcional)</span>
          <LocalizedNumberInput v-model="form.monthlySpendingLimit" placeholder="Ex.: 250,00" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700" />
        </label>
      </div>

      <div class="mt-5">
        <p class="text-sm font-semibold">Foto de fundo</p>
        <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button
            v-for="background in backgrounds"
            :key="background.id"
            type="button"
            class="overflow-hidden rounded-xl border text-[11px] font-bold"
            :class="form.backgroundImage === background.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 dark:border-slate-700'"
            @click="form.backgroundImage = background.id"
          >
            <span
              class="block h-12 bg-slate-100 bg-cover bg-center dark:bg-slate-800"
              :style="background.id === 'none' ? {} : { backgroundImage: `url(/card-backgrounds/${background.id}.svg)` }"
            ></span>
            <span class="block px-1 py-2">{{ background.label }}</span>
          </button>
        </div>
      </div>

      <div class="mt-5">
        <p class="text-sm font-semibold">Aparência</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="(palette, index) in palettes"
            :key="palette.name"
            type="button"
            class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
            :class="form.palette === index ? 'border-slate-950 dark:border-white' : 'border-slate-200 dark:border-slate-700'"
            @click="form.palette = index"
          >
            <span class="size-5 rounded-full" :style="{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }"></span>
            {{ palette.name }}
          </button>
        </div>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold">
          Textura
          <select v-model="form.pattern" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="soft">Suave</option><option value="waves">Ondas</option><option value="dots">Pontos</option><option value="grid">Grade</option><option value="aurora">Aurora</option>
          </select>
        </label>
        <label class="grid gap-1.5 text-sm font-semibold">
          Sticker <span class="font-normal text-slate-400">(opcional)</span>
          <select v-model="form.emoji" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 dark:border-slate-700">
            <option value="">Sem sticker</option><option>💸</option><option>🍊</option><option>🎮</option><option>🚀</option><option>🌴</option><option>🧠</option><option>⚡</option>
          </select>
        </label>
      </div>

      <label class="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p class="font-bold">Definir como principal</p>
          <p class="text-xs text-slate-500">Será selecionado automaticamente em novas despesas.</p>
        </div>
        <input v-model="form.isDefault" type="checkbox" class="size-5 accent-emerald-500" />
      </label>

      <button class="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white hover:bg-slate-800 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300">
        Adicionar à carteira
      </button>
    </form>
  </div>
</template>
