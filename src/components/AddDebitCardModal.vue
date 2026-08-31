<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ShieldCheck, X, Sparkles, CreditCard } from 'lucide-vue-next'
import type { CardBackground, CardNetwork, CardPattern, NewDebitCardInput } from '../types/finance'
import { localizedDecimalToStorage } from '../services/localizedNumber'
import LocalizedNumberInput from './LocalizedNumberInput.vue'
import AppModal from './AppModal.vue'

const props = withDefaults(defineProps<{
  existingCardsCount: number
  busy?: boolean
  saveError?: string
  elevated?: boolean
}>(), { busy: false, saveError: '', elevated: false })
const emit = defineEmits<{
  close: []
  save: [input: NewDebitCardInput]
}>()

const error = ref('')

const palettes = [
  { name: 'Grafite', from: '#0F172A', to: '#334155' },
  { name: 'Laranja', from: '#F97316', to: '#C2410C' },
  { name: 'Esmeralda', from: '#059669', to: '#065F46' },
  { name: 'Azul', from: '#2563EB', to: '#1E3A8A' },
  { name: 'Violeta', from: '#7C3AED', to: '#4C1D95' },
  { name: 'Rosa Neon', from: '#E11D48', to: '#881337' },
]

const backgrounds: { id: CardBackground; label: string }[] = [
  { id: 'none', label: 'Sem foto' },
  { id: 'amazonia', label: 'Amazônia' },
  { id: 'praia', label: 'Praia' },
  { id: 'cidade', label: 'Cidade' },
  { id: 'montanhas', label: 'Montanhas' },
]

const form = reactive({
  name: '',
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
  if (props.busy) return
  error.value = ''
  const lastFour = form.lastFour.replace(/\D/g, '')

  if (!form.name.trim()) {
    error.value = 'Informe um apelido para o cartão.'
    return
  }
  if (!form.issuer.trim()) {
    error.value = 'Informe o banco ou emissor do cartão.'
    return
  }
  if (!form.holderName.trim()) {
    error.value = 'Informe o nome do titular.'
    return
  }
  if (!/^\d{4}$/.test(lastFour)) {
    error.value = 'Informe exatamente os 4 últimos dígitos do cartão.'
    return
  }

  let limit = ''
  if (form.monthlySpendingLimit.trim()) {
    try {
      limit = localizedDecimalToStorage(form.monthlySpendingLimit)
    } catch {
      error.value = 'Valor de limite inválido.'
      return
    }
    if (Number(limit) <= 0) {
      error.value = 'O limite de controle deve ser maior que zero.'
      return
    }
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
  <AppModal as="form" aria-labelledby="add-card-title" :root-class="elevated ? 'z-[120]' : 'z-50'" panel-class="p-5 sm:max-w-xl sm:p-6" :closeable="!busy" @close="emit('close')" @submit="submit">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-bold text-emerald-600">Carteira</p>
          <h2 id="add-card-title" class="text-2xl font-black tracking-tight">Adicionar cartão</h2>
        </div>
        <button type="button" :disabled="busy" class="pingo-modal-close" aria-label="Fechar" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
        <ShieldCheck :size="20" class="mt-0.5 shrink-0" />
        <p><strong>Privacidade:</strong> informe somente os 4 últimos dígitos. O app não precisa de número completo, validade ou CVV.</p>
      </div>

      <!-- Preview Interativo do Cartão -->
      <div class="mt-5">
        <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Pré-visualização</p>
        <div
          class="relative flex h-48 w-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-xl transition-all duration-300"
          :style="{
            background: form.backgroundImage === 'none'
              ? `linear-gradient(135deg, ${selectedPalette.from}, ${selectedPalette.to})`
              : `url(/card-backgrounds/${form.backgroundImage}.svg) center/cover`
          }"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-medium opacity-80">{{ form.issuer || 'NOME DO BANCO' }}</p>
              <p class="text-lg font-bold tracking-wide">{{ form.name || 'Apelido do Cartão' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="form.emoji" class="text-2xl">{{ form.emoji }}</span>
              <span class="rounded-md bg-white/20 px-2 py-1 text-xs font-black uppercase backdrop-blur-md">
                {{ form.network }}
              </span>
            </div>
          </div>

          <div class="my-auto flex items-center gap-3">
            <CreditCard :size="32" class="opacity-80" />
            <span class="font-mono text-xl tracking-[0.2em]">•••• •••• •••• {{ form.lastFour || '0000' }}</span>
          </div>

          <div class="flex items-end justify-between">
            <div>
              <p class="text-[10px] uppercase opacity-70">Titular</p>
              <p class="font-mono text-sm uppercase tracking-wider">{{ form.holderName || 'SEU NOME AQUI' }}</p>
            </div>
            <span v-if="form.isDefault" class="rounded-full bg-emerald-500/80 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              Principal
            </span>
          </div>
        </div>
      </div>

      <!-- Formulário de Dados -->
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold">
          Apelido do cartão
          <input v-model="form.name" maxlength="40" placeholder="Ex.: Inter principal" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700" />
        </label>

        <label class="grid gap-1.5 text-sm font-semibold">
          Banco / emissor
          <input v-model="form.issuer" maxlength="60" placeholder="Ex.: Banco Inter" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700" />
        </label>

        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Nome do titular
          <input v-model="form.holderName" maxlength="80" placeholder="Como aparece impresso no cartão" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 uppercase outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700" />
        </label>

        <label class="grid gap-1.5 text-sm font-semibold">
          Últimos 4 dígitos
          <input v-model="form.lastFour" inputmode="numeric" maxlength="4" placeholder="4242" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 font-mono tracking-[0.2em] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700" />
        </label>

        <label class="grid gap-1.5 text-sm font-semibold">
          Bandeira
          <select v-model="form.network" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700">
            <option value="mastercard">Mastercard</option>
            <option value="visa">Visa</option>
            <option value="elo">Elo</option>
            <option value="other">Outra</option>
          </select>
        </label>

        <label class="grid gap-1.5 text-sm font-semibold sm:col-span-2">
          Limite mensal de controle <span class="font-normal text-slate-400">(opcional)</span>
          <LocalizedNumberInput v-model="form.monthlySpendingLimit" placeholder="Ex.: 250,00" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700" />
        </label>
      </div>

      <!-- Foto de Fundo -->
      <div class="mt-5">
        <p class="text-sm font-semibold">Foto de fundo</p>
        <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button
            v-for="background in backgrounds"
            :key="background.id"
            type="button"
            class="overflow-hidden rounded-xl border text-[11px] font-bold transition"
            :class="form.backgroundImage === background.id ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900' : 'border-slate-200 dark:border-slate-700'"
            @click="form.backgroundImage = background.id"
          >
            <span
              class="block h-12 bg-slate-100 bg-cover bg-center dark:bg-slate-800"
              :style="background.id === 'none' ? {} : { backgroundImage: `url(/card-backgrounds/${background.id}.svg)` }"
            ></span>
            <span class="block px-1 py-2 text-center">{{ background.label }}</span>
          </button>
        </div>
      </div>

      <!-- Aparencia / Cores -->
      <div class="mt-5">
        <p class="text-sm font-semibold">Cor do cartão</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="(palette, index) in palettes"
            :key="palette.name"
            type="button"
            class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition"
            :class="form.palette === index ? 'border-slate-950 ring-2 ring-slate-200 dark:border-white dark:ring-slate-800' : 'border-slate-200 dark:border-slate-700'"
            @click="form.palette = index"
          >
            <span class="size-5 rounded-full" :style="{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }"></span>
            {{ palette.name }}
          </button>
        </div>
      </div>

      <!-- Textura e Sticker -->
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1.5 text-sm font-semibold">
          Textura
          <select v-model="form.pattern" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none transition focus:border-emerald-500 dark:border-slate-700">
            <option value="soft">Suave</option>
            <option value="waves">Ondas</option>
            <option value="dots">Pontos</option>
            <option value="grid">Grade</option>
            <option value="aurora">Aurora</option>
          </select>
        </label>

        <label class="grid gap-1.5 text-sm font-semibold">
          Sticker <span class="font-normal text-slate-400">(opcional)</span>
          <select v-model="form.emoji" class="rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none transition focus:border-emerald-500 dark:border-slate-700">
            <option value="">Sem sticker</option>
            <option>💸</option>
            <option>🍊</option>
            <option>🎮</option>
            <option>🚀</option>
            <option>🌴</option>
            <option>🧠</option>
            <option>⚡</option>
            <option>💎</option>
            <option>👑</option>
            <option>🔥</option>
          </select>
        </label>
      </div>

      <!-- Definir como principal -->
      <label class="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
        <div>
          <p class="font-bold text-sm">Definir como principal</p>
          <p class="text-xs text-slate-500">Será selecionado automaticamente ao registrar novas despesas.</p>
        </div>
        <input v-model="form.isDefault" type="checkbox" class="size-5 accent-emerald-500" />
      </label>

      <!-- Mensagem de Erro -->
      <p v-if="error || saveError" class="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
        {{ error || saveError }}
      </p>

      <!-- Botão de Ação -->
      <button type="submit" :disabled="busy" class="pingo-modal-footer btn mt-6 h-14 min-h-14 w-full rounded-2xl border-0 bg-emerald-600 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
        <Sparkles :size="18" :class="busy ? 'animate-pulse' : ''" />
        {{ busy ? 'Guardando…' : 'Adicionar à carteira' }}
      </button>
  </AppModal>
</template>
