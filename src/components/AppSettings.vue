<script setup lang="ts">
import { ref } from 'vue'
import {
  BatteryCharging, Bell, Database, Download, Eye, Gauge, HardDrive, Mic, Move3d,
  RotateCcw, ShieldCheck, Smartphone, X,
} from 'lucide-vue-next'
import FactoryResetDialog from './FactoryResetDialog.vue'
import { useFinanceStore } from '../stores/financeStore'
import { exportBackup } from '../services/backup'
import { isTauriRuntime } from '../services/financeRepository'
import { DASHBOARD_WIDGETS } from '../services/dashboardLayout'
import { requestMotionPermission } from '../services/deviceExperience'
import {
  disableMoneyReminders, enableMoneyReminders, loadReminderSettings, sendReminderTest,
  type ReminderFrequencyDays,
} from '../services/notifications'
import type { DashboardWidgetId, FeedbackDurationMs, ShakeSensitivity } from '../types/finance'

const emit = defineEmits<{ close: [] }>()
const store = useFinanceStore()
const exporting = ref(false)
const confirmingReset = ref(false)
const resetting = ref(false)
const sensorBusy = ref(false)
const reminderBusy = ref(false)
const reminderSettings = ref(loadReminderSettings())
const reminderFrequency = ref<ReminderFrequencyDays>(reminderSettings.value.frequencyDays)

function updatePreference(event: Event, key: 'voiceShortcutsEnabled' | 'dailySpendingAlertsEnabled' | 'greetingEnabled' | 'economyMode') {
  store.updatePreferences({ [key]: (event.target as HTMLInputElement).checked })
}

function updateSensitivity(event: Event) {
  store.updatePreferences({ shakeSensitivity: (event.target as HTMLSelectElement).value as ShakeSensitivity })
}

function updateAlertPercent(event: Event) {
  store.updatePreferences({ spendingAlertPercent: Number((event.target as HTMLInputElement).value) })
}

function updateFeedbackDuration(event: Event) {
  store.updatePreferences({ feedbackDurationMs: Number((event.target as HTMLSelectElement).value) as FeedbackDurationMs })
}

async function toggleShake(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked
  if (!enabled) { store.updatePreferences({ shakeToExpenseEnabled: false }); return }
  sensorBusy.value = true
  try {
    await requestMotionPermission()
    store.updatePreferences({ shakeToExpenseEnabled: true })
    store.showFeedback('Atalho por movimento ativado.', 'success')
  } catch (cause) {
    store.updatePreferences({ shakeToExpenseEnabled: false })
    store.reportError(cause, 'Não foi possível ativar o sensor.')
  } finally { sensorBusy.value = false }
}

function toggleWidget(id: DashboardWidgetId, event: Event) {
  const layout = { widgets: store.dashboardLayout.widgets.map((item) => ({ ...item })) }
  const widget = layout.widgets.find((item) => item.id === id)
  if (widget) widget.visible = (event.target as HTMLInputElement).checked
  void store.saveDashboard(layout).catch((cause) => store.reportError(cause, 'Não foi possível salvar a tela inicial.'))
}

async function saveReminders() {
  reminderBusy.value = true
  try {
    reminderSettings.value = await enableMoneyReminders(reminderFrequency.value)
    store.showFeedback('Lembretes do Pingo atualizados.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível ativar os lembretes.') }
  finally { reminderBusy.value = false }
}

async function disableReminders() {
  reminderBusy.value = true
  try { reminderSettings.value = await disableMoneyReminders() }
  finally { reminderBusy.value = false }
}

async function testReminder() {
  try { await sendReminderTest() }
  catch (cause) { store.reportError(cause, 'Não foi possível testar a notificação.') }
}

async function downloadBackup() {
  exporting.value = true
  try {
    await exportBackup({
      transactions: [...store.transactions], categories: [...store.categories],
      debitCards: [...store.debitCards], vaults: [...store.vaults],
      vaultMovements: [...store.vaultMovements], automaticReserveRules: [...store.automaticReserveRules],
      monthlyReserveRules: [...store.monthlyReserveRules], digitalWalletItems: [...store.digitalWalletItems],
      dashboardLayout: { widgets: store.dashboardLayout.widgets.map((item) => ({ ...item })) },
      recurringRules: [...store.recurringRules], accountSettings: { ...store.accountSettings },
      preferences: { ...store.preferences },
    })
    store.showFeedback('Backup gerado. Guarde o arquivo em um local seguro.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível gerar o backup.') }
  finally { exporting.value = false }
}

async function factoryReset() {
  resetting.value = true
  try { await store.factoryReset() }
  catch (cause) {
    resetting.value = false
    store.reportError(cause, 'Não foi possível apagar os dados.')
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[80] flex items-end bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <section class="max-h-[94dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-2xl sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="app-settings-title">
      <div class="flex items-start justify-between gap-3"><div class="flex items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Database :size="21" /></div><div><p class="text-sm font-bold text-sky-600">Tudo em um só lugar</p><h2 id="app-settings-title" class="text-xl font-black">Central do Pingo</h2><p class="mt-1 text-xs text-slate-500">Comportamento, atalhos, alertas, tela inicial e dados.</p></div></div><button class="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="Fechar configurações" @click="emit('close')"><X :size="19" /></button></div>

      <div class="mt-5 grid gap-4">
        <section class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-start gap-3"><Move3d :size="20" class="mt-0.5 shrink-0 text-violet-600" /><div><h3 class="font-black">Atalhos do aparelho</h3><p class="mt-1 text-xs text-slate-500">Funcionam enquanto o Pingo está aberto. O microfone só é acionado quando você toca no botão de voz.</p></div></div>
          <label class="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span class="flex min-w-0 items-center gap-3"><Mic :size="18" class="shrink-0" /><span><strong class="block text-sm">Atalhos de voz</strong><span class="block text-xs text-slate-500">“Novo gasto”, “Carteira”, “Porquinhos” ou “Resumo”.</span></span></span><input type="checkbox" class="size-5 accent-violet-600" :checked="store.preferences.voiceShortcutsEnabled" @change="updatePreference($event, 'voiceShortcutsEnabled')" /></label>
          <label class="mt-2 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span><strong class="block text-sm">Agitar para novo gasto</strong><span class="block text-xs text-slate-500">Abre o gasto rápido no Resumo; possui proteção contra disparos repetidos.</span></span><input type="checkbox" class="size-5 accent-violet-600" :checked="store.preferences.shakeToExpenseEnabled" :disabled="sensorBusy" @change="toggleShake" /></label>
          <label class="mt-2 grid gap-1 text-xs font-bold">Sensibilidade do gesto<select :value="store.preferences.shakeSensitivity" class="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700" @change="updateSensitivity"><option value="low">Baixa · exige movimento forte</option><option value="medium">Média · equilibrada</option><option value="high">Alta · movimento mais leve</option></select></label>
        </section>

        <section class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-start gap-3"><Gauge :size="20" class="mt-0.5 shrink-0 text-emerald-600" /><div><h3 class="font-black">Radar de gastos diários</h3><p class="mt-1 text-xs text-slate-500">Compara os gastos de hoje com o valor que pode ser usado sem tocar nos Porquinhos.</p></div></div>
          <label class="mt-4 flex items-center justify-between gap-4"><span class="text-sm font-bold">Avisar durante o dia</span><input type="checkbox" class="size-5 accent-emerald-600" :checked="store.preferences.dailySpendingAlertsEnabled" @change="updatePreference($event, 'dailySpendingAlertsEnabled')" /></label>
          <label class="mt-4 grid gap-2 text-xs font-bold"><span class="flex justify-between"><span>Limite do alerta</span><strong class="text-emerald-600">{{ store.preferences.spendingAlertPercent }}%</strong></span><input type="range" min="50" max="100" step="5" :value="store.preferences.spendingAlertPercent" class="accent-emerald-600" @input="updateAlertPercent" /></label>
        </section>

        <section class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-start gap-3"><Eye :size="20" class="mt-0.5 shrink-0 text-sky-600" /><div><h3 class="font-black">Tela inicial</h3><p class="mt-1 text-xs text-slate-500">Escolha o que aparece. Ordem e tamanho continuam ajustáveis diretamente no botão Personalizar do Resumo.</p></div></div>
          <div class="mt-3 grid gap-2 sm:grid-cols-2"><label v-for="widget in store.dashboardLayout.widgets" :key="widget.id" class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs font-bold dark:bg-slate-950"><span class="truncate">{{ DASHBOARD_WIDGETS[widget.id].label }}</span><input type="checkbox" class="size-4 shrink-0 accent-sky-600" :checked="widget.visible" @change="toggleWidget(widget.id, $event)" /></label></div>
          <label class="mt-3 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><span><strong class="block text-sm">Saudação pelo horário</strong><span class="block text-xs text-slate-500">Bom dia, boa tarde ou boa noite conforme a hora local.</span></span><input type="checkbox" class="size-5 accent-sky-600" :checked="store.preferences.greetingEnabled" @change="updatePreference($event, 'greetingEnabled')" /></label>
        </section>

        <section class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-start gap-3"><BatteryCharging :size="20" class="mt-0.5 shrink-0 text-amber-600" /><div><h3 class="font-black">Economia e avisos</h3><p class="mt-1 text-xs text-slate-500">O modo econômico reduz animações, transparências e efeitos visuais.</p></div></div>
          <label class="mt-4 flex items-center justify-between gap-4"><span class="text-sm font-bold">Modo econômico</span><input type="checkbox" class="size-5 accent-amber-600" :checked="store.preferences.economyMode" @change="updatePreference($event, 'economyMode')" /></label>
          <label class="mt-3 grid gap-1 text-xs font-bold">Tempo das mensagens<select :value="store.preferences.feedbackDurationMs" class="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700" @change="updateFeedbackDuration"><option :value="3000">3 segundos</option><option :value="4000">4 segundos</option><option :value="5000">5 segundos</option></select></label>
        </section>

        <section class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-start gap-3"><Bell :size="20" class="mt-0.5 shrink-0 text-emerald-600" /><div><h3 class="font-black">Lembretes do Pingo</h3><p class="mt-1 text-xs text-slate-500">{{ reminderSettings.enabled ? 'Ativos neste dispositivo.' : 'Desativados.' }} Na Web, o navegador precisa estar aberto.</p></div></div>
          <div class="mt-3 grid grid-cols-3 gap-2"><button v-for="option in ([{ days: 1, label: 'Diário' }, { days: 3, label: '3 dias' }, { days: 7, label: 'Semanal' }] as const)" :key="option.days" type="button" class="rounded-xl border px-2 py-2 text-xs font-black" :class="reminderFrequency === option.days ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950' : 'border-slate-200 dark:border-slate-700'" @click="reminderFrequency = option.days">{{ option.label }}</button></div>
          <div class="mt-3 grid grid-cols-3 gap-2"><button :disabled="reminderBusy" class="rounded-xl bg-emerald-400 px-2 py-2.5 text-xs font-black text-slate-950 disabled:opacity-40" @click="saveReminders">{{ reminderSettings.enabled ? 'Atualizar' : 'Ativar' }}</button><button class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-black dark:border-slate-700" @click="testReminder">Testar</button><button :disabled="!reminderSettings.enabled || reminderBusy" class="rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-black disabled:opacity-40 dark:border-slate-700" @click="disableReminders">Desativar</button></div>
        </section>
      </div>

      <div class="mt-5 grid gap-3 sm:grid-cols-3"><article class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><HardDrive :size="20" class="mt-0.5 shrink-0 text-emerald-600" /><div><p class="text-sm font-black">{{ isTauriRuntime() ? 'SQLite local' : 'Neste navegador' }}</p><p class="mt-1 text-xs leading-relaxed text-slate-500">Seus dados permanecem neste dispositivo.</p></div></article><article class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><ShieldCheck :size="20" class="mt-0.5 shrink-0 text-violet-600" /><div><p class="text-sm font-black">Sem conexão bancária</p><p class="mt-1 text-xs leading-relaxed text-slate-500">Importações são lidas localmente.</p></div></article><article class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><Smartphone :size="20" class="mt-0.5 shrink-0 text-amber-600" /><div><p class="text-sm font-black">Pingo 0.10.0</p><p class="mt-1 text-xs leading-relaxed text-slate-500">Mobile, nativo e personalizável.</p></div></article></div>

      <section class="mt-5 rounded-2xl bg-slate-950 p-5 text-white dark:bg-slate-800"><div class="flex items-start gap-3"><Download :size="21" class="mt-0.5 shrink-0 text-emerald-300" /><div><h3 class="font-black">Faça uma cópia dos seus dados</h3><p class="mt-1 text-xs leading-relaxed text-slate-300">O arquivo contém valores e descrições financeiras. Proteja-o como um extrato.</p></div></div><button :disabled="exporting" class="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-emerald-950 disabled:opacity-50" @click="downloadBackup">{{ exporting ? 'Preparando…' : 'Exportar backup em JSON' }}</button></section>

      <section class="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900 dark:bg-rose-950/20"><div class="flex gap-3"><RotateCcw :size="20" class="mt-0.5 shrink-0 text-rose-600" /><div><h3 class="text-sm font-black">Reset total</h3><p class="mt-1 text-xs leading-relaxed text-slate-500">Apaga transações, cartões, documentos, Porquinhos, automações, preferências e configurações. Não pode ser desfeito.</p></div></div><button class="shrink-0 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white" @click="confirmingReset = true">Apagar tudo</button></section>
    </section>
  </div>
  <FactoryResetDialog v-if="confirmingReset" :busy="resetting" @cancel="confirmingReset = false" @confirm="factoryReset" />
</template>
