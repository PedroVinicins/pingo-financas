<script setup lang="ts">
import { ref } from 'vue'
import { Bell, BellOff, Check, X } from 'lucide-vue-next'
import {
  disableMoneyReminders,
  enableMoneyReminders,
  loadReminderSettings,
  sendReminderTest,
  type ReminderFrequencyDays,
} from '../services/notifications'

const emit = defineEmits<{ close: [] }>()
const settings = ref(loadReminderSettings())
const frequencyDays = ref<ReminderFrequencyDays>(settings.value.frequencyDays)
const saving = ref(false)
const error = ref('')
const success = ref('')
const frequencyOptions: { days: ReminderFrequencyDays; label: string }[] = [
  { days: 1, label: 'Todo dia' },
  { days: 3, label: '3 dias' },
  { days: 7, label: 'Semanal' },
]

async function enable() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    settings.value = await enableMoneyReminders(frequencyDays.value)
    success.value = 'Lembretes ativados com sucesso.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível ativar os lembretes.'
  } finally {
    saving.value = false
  }
}

async function disable() {
  saving.value = true
  settings.value = await disableMoneyReminders()
  success.value = 'Lembretes desativados.'
  saving.value = false
}

async function test() {
  error.value = ''
  try {
    await sendReminderTest()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível enviar a notificação.'
  }
}
</script>

<template>
  <div class="pingo-modal-backdrop fixed inset-0 z-[80] flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <section class="pingo-modal-panel w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Bell :size="21" /></div>
          <div><p class="text-sm font-bold text-emerald-600">Alertas do Pingo</p><h2 class="text-xl font-black">Não esqueça de atualizar</h2></div>
        </div>
        <button type="button" class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" @click="emit('close')"><X :size="19" /></button>
      </div>

      <p class="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Receba lembretes como “Você mexeu no seu dinheiro?” e abra o Pingo para registrar entradas e despesas.</p>

      <div class="mt-5 grid gap-2">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Frequência</p>
        <div class="grid grid-cols-3 gap-2">
          <button v-for="option in frequencyOptions" :key="option.days" type="button" class="rounded-xl border px-2 py-2.5 text-sm font-bold" :class="frequencyDays === option.days ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'" @click="frequencyDays = option.days">{{ option.label }}</button>
        </div>
      </div>

      <div class="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950">
        <Check v-if="settings.enabled" :size="17" class="text-emerald-600" />
        <BellOff v-else :size="17" />
        {{ settings.enabled ? 'Lembretes estão ativos neste dispositivo.' : 'Lembretes estão desativados.' }}
      </div>

      <p v-if="error" class="mt-3 text-sm font-bold text-rose-600">{{ error }}</p>
      <p v-if="success" class="mt-3 text-sm font-bold text-emerald-600">{{ success }}</p>

      <button type="button" class="mt-5 w-full rounded-2xl bg-emerald-400 py-3.5 font-black text-slate-950 disabled:opacity-50" :disabled="saving" @click="enable">{{ saving ? 'Salvando…' : settings.enabled ? 'Atualizar lembretes' : 'Ativar lembretes' }}</button>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button type="button" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold dark:border-slate-700" @click="test">Testar alerta</button>
        <button type="button" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold disabled:opacity-40 dark:border-slate-700" :disabled="!settings.enabled || saving" @click="disable">Desativar</button>
      </div>
      <p class="mt-3 text-center text-[11px] text-slate-400">Na Web, o navegador precisa estar aberto. No Android, o sistema agenda o lembrete.</p>
    </section>
  </div>
</template>
