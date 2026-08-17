<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BatteryCharging, Bell, Database, Download, Eye, FileDown, Gauge, HardDrive, LockKeyhole,
  Mic, Move3d, Palette, RefreshCw, RotateCcw, ShieldCheck, Smartphone, Upload, X,
} from 'lucide-vue-next'
import AppSwitch from './AppSwitch.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import FactoryResetDialog from './FactoryResetDialog.vue'
import ProfileCard from './ProfileCard.vue'
import SettingsGroup from './SettingsGroup.vue'
import SettingsRow from './SettingsRow.vue'
import { useFinanceStore } from '../stores/financeStore'
import { exportBackup, exportTransactionsCsv, parseBackupFile, type PingoBackup } from '../services/backup'
import { isTauriRuntime } from '../services/financeRepository'
import { DASHBOARD_WIDGETS } from '../services/dashboardLayout'
import { requestMotionPermission } from '../services/deviceExperience'
import { localizedDecimalToStorage, storageDecimalToLocalized } from '../services/localizedNumber'
import { disableMoneyReminders, enableMoneyReminders, loadReminderSettings, sendReminderTest, type ReminderFrequencyDays } from '../services/notifications'
import type { DashboardWidgetId, FeedbackDurationMs, PingoPreferences, ShakeSensitivity, ThemeMode } from '../types/finance'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
const emit = defineEmits<{ close: [] }>()
const store = useFinanceStore()
const exporting = ref(false)
const exportingCsv = ref(false)
const backupInput = ref<HTMLInputElement | null>(null)
const pendingBackup = ref<PingoBackup | null>(null)
const restoringBackup = ref(false)
const confirmingReset = ref(false)
const resetting = ref(false)
const sensorBusy = ref(false)
const reminderBusy = ref(false)
const editingProfile = ref(false)
const profileDraft = ref(store.preferences.displayName)
const budgetDraft = ref(store.preferences.monthlyBudget ? storageDecimalToLocalized(store.preferences.monthlyBudget) : '')
const budgetError = ref('')
const reminderSettings = ref(loadReminderSettings())
const reminderFrequency = ref<ReminderFrequencyDays>(reminderSettings.value.frequencyDays)

const displayName = computed(() => store.preferences.displayName || 'Você')
const expenseCategories = computed(() => store.categories.filter((item) => item.kind === 'expense').length)
const incomeCategories = computed(() => store.categories.filter((item) => item.kind === 'income').length)
const walletCount = computed(() => store.debitCards.length + store.digitalWalletItems.length)
const monthlyBudgetLabel = computed(() => store.preferences.monthlyBudget
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(store.preferences.monthlyBudget))
  : 'Não definido')

function updateBoolean(key: keyof PingoPreferences, value: boolean) { store.updatePreferences({ [key]: value }) }
function setTheme(themeMode: ThemeMode) { store.updatePreferences({ themeMode }) }
function saveProfile() {
  const name = profileDraft.value.trim().slice(0, 60)
  store.updatePreferences({ displayName: name })
  editingProfile.value = false
  store.showFeedback('Perfil atualizado.', 'success')
}
function saveBudget() {
  budgetError.value = ''
  if (!budgetDraft.value.trim()) { store.updatePreferences({ monthlyBudget: null }); return }
  try {
    const value = localizedDecimalToStorage(budgetDraft.value)
    if (Number(value) <= 0) throw new Error()
    store.updatePreferences({ monthlyBudget: value })
  } catch { budgetError.value = 'Informe um limite maior que zero.' }
}
async function toggleShake(enabled: boolean) {
  if (!enabled) { store.updatePreferences({ shakeToExpenseEnabled: false }); return }
  sensorBusy.value = true
  try { await requestMotionPermission(); store.updatePreferences({ shakeToExpenseEnabled: true }); store.showFeedback('Agitar para gasto foi ativado.', 'success') }
  catch (cause) { store.updatePreferences({ shakeToExpenseEnabled: false }); store.reportError(cause, 'Não foi possível ativar o sensor.') }
  finally { sensorBusy.value = false }
}
async function toggleExpenseReminder(enabled: boolean) {
  reminderBusy.value = true
  try {
    if (enabled) reminderSettings.value = await enableMoneyReminders(reminderFrequency.value)
    else reminderSettings.value = await disableMoneyReminders()
    store.updatePreferences({ expenseReminderNotifications: enabled })
  } catch (cause) { store.reportError(cause, 'Não foi possível alterar os lembretes.') }
  finally { reminderBusy.value = false }
}
async function updateReminderFrequency() {
  if (!store.preferences.expenseReminderNotifications) return
  reminderSettings.value = await enableMoneyReminders(reminderFrequency.value)
}
function toggleWidget(id: DashboardWidgetId, visible: boolean) {
  const layout = { widgets: store.dashboardLayout.widgets.map((item) => ({ ...item })) }
  const widget = layout.widgets.find((item) => item.id === id)
  if (widget) widget.visible = visible
  void store.saveDashboard(layout).catch((cause) => store.reportError(cause, 'Não foi possível salvar a tela inicial.'))
}
async function resetHome() {
  try { await store.resetDashboard() }
  catch (cause) { store.reportError(cause, 'Não foi possível restaurar a tela inicial.') }
}
function backupData() {
  return {
    transactions: [...store.transactions], categories: [...store.categories], debitCards: [...store.debitCards],
    vaults: [...store.vaults], vaultMovements: [...store.vaultMovements], automaticReserveRules: [...store.automaticReserveRules],
    monthlyReserveRules: [...store.monthlyReserveRules], digitalWalletItems: [...store.digitalWalletItems],
    dashboardLayout: { widgets: store.dashboardLayout.widgets.map((item) => ({ ...item })) }, recurringRules: [...store.recurringRules],
    accountSettings: { ...store.accountSettings }, preferences: { ...store.preferences },
  }
}
async function downloadBackup() {
  exporting.value = true
  try { await exportBackup(backupData()); store.showFeedback('Backup local gerado.', 'success') }
  catch (cause) { store.reportError(cause, 'Não foi possível gerar o backup.') }
  finally { exporting.value = false }
}
async function downloadCsv() {
  exportingCsv.value = true
  try { await exportTransactionsCsv(store.transactions, store.categories, store.debitCards); store.showFeedback('CSV exportado.', 'success') }
  catch (cause) { store.reportError(cause, 'Não foi possível exportar o CSV.') }
  finally { exportingCsv.value = false }
}
async function chooseBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try { pendingBackup.value = await parseBackupFile(file) }
  catch (cause) { store.reportError(cause, 'Não foi possível ler o backup.') }
}
async function confirmRestoreBackup() {
  if (!pendingBackup.value) return
  restoringBackup.value = true
  try { await store.restoreBackup(pendingBackup.value.data) }
  catch (cause) {
    restoringBackup.value = false
    store.reportError(cause, 'Não foi possível restaurar o backup.')
  }
}
async function factoryReset() {
  resetting.value = true
  try { await store.factoryReset() }
  catch (cause) { resetting.value = false; store.reportError(cause, 'Não foi possível apagar os dados.') }
}
</script>

<template>
  <div :class="props.embedded ? 'mx-auto min-h-dvh max-w-[1440px] px-5 pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-7 lg:px-10 lg:py-9' : 'fixed inset-0 z-[80] overflow-y-auto bg-canvas px-5 py-6'" @click.self="!props.embedded && emit('close')">
    <main :class="props.embedded ? '' : 'mx-auto max-w-4xl'">
      <header class="flex items-start justify-between gap-4">
        <div><p class="text-sm font-semibold text-brand">Pingo do seu jeito</p><h1 class="mt-1 text-[clamp(2rem,7vw,2.75rem)] font-extrabold tracking-[-0.045em]">Ajustes</h1><p class="mt-1 text-sm text-subtle">Perfil, aparência, notificações, atalhos e segurança.</p></div>
        <button v-if="!props.embedded" class="grid size-11 place-items-center rounded-full bg-muted" aria-label="Fechar ajustes" @click="emit('close')"><X :size="19" /></button>
      </header>

      <div class="mt-7 grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="grid gap-7">
          <SettingsGroup title="Orçamento">
            <SettingsRow label="Limite mensal" :description="budgetError || 'Usado no progresso do saldo principal.'">
              <template #control><div class="flex items-center gap-2" @click.stop><span class="text-sm text-subtle">R$</span><input v-model="budgetDraft" inputmode="decimal" class="h-10 w-24 rounded-xl border border-line bg-canvas px-3 text-right text-sm font-semibold" placeholder="0,00" aria-label="Limite mensal" @blur="saveBudget" @keyup.enter="($event.target as HTMLInputElement).blur()" /></div></template>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Aparência">
            <SettingsRow label="Tema" description="A opção Sistema acompanha o aparelho.">
              <template #control><div class="flex rounded-xl bg-muted p-1" @click.stop><button v-for="option in ([['light','Claro'],['dark','Escuro'],['system','Sistema']] as const)" :key="option[0]" class="min-h-9 rounded-lg px-2 text-[11px] font-bold" :class="store.preferences.themeMode === option[0] ? 'bg-surface text-brand shadow-sm' : 'text-subtle'" @click="setTheme(option[0])">{{ option[1] }}</button></div></template>
            </SettingsRow>
            <SettingsRow label="Privacidade do saldo" description="Oculta valores sem alterar o espaço do layout."><template #control><AppSwitch :model-value="store.balanceHidden" label="Ocultar valores financeiros" @update:model-value="store.toggleBalanceVisibility" /></template></SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Registro">
            <SettingsRow label="Categorias de gasto" :value="`${expenseCategories} ativas`" />
            <SettingsRow label="Categorias de receita" :value="`${incomeCategories} ativas`" />
            <SettingsRow label="Carteiras" :value="`${walletCount} ativas`" />
            <SettingsRow label="Moeda padrão" value="BRL • R$" />
          </SettingsGroup>

          <SettingsGroup title="Notificações">
            <SettingsRow label="Contas próximas do vencimento"><template #control><AppSwitch :model-value="store.preferences.billsDueNotifications" label="Avisar contas próximas do vencimento" @update:model-value="updateBoolean('billsDueNotifications', $event)" /></template></SettingsRow>
            <SettingsRow label="Resumo da semana"><template #control><AppSwitch :model-value="store.preferences.weeklySummaryNotifications" label="Receber resumo da semana" @update:model-value="updateBoolean('weeklySummaryNotifications', $event)" /></template></SettingsRow>
            <SettingsRow label="Lembrete para registrar gastos" :description="reminderSettings.enabled ? 'Ativo neste dispositivo.' : 'Desativado.'"><template #control><AppSwitch :model-value="store.preferences.expenseReminderNotifications" label="Lembrete para registrar gastos" :disabled="reminderBusy" @update:model-value="toggleExpenseReminder" /></template></SettingsRow>
            <SettingsRow label="Frequência do lembrete"><template #control><select v-model="reminderFrequency" class="h-10 rounded-xl border border-line bg-canvas px-2 text-sm" @click.stop @change="updateReminderFrequency"><option :value="1">Diário</option><option :value="3">A cada 3 dias</option><option :value="7">Semanal</option></select></template></SettingsRow>
            <SettingsRow label="Testar notificação" clickable @activate="sendReminderTest"><template #icon><Bell :size="18" class="text-brand" /></template></SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Central do Pingo">
            <SettingsRow label="Atalhos de voz" description="Ativados apenas quando você toca no microfone."><template #icon><Mic :size="18" class="text-brand" /></template><template #control><AppSwitch :model-value="store.preferences.voiceShortcutsEnabled" label="Atalhos de voz" @update:model-value="updateBoolean('voiceShortcutsEnabled', $event)" /></template></SettingsRow>
            <SettingsRow label="Agitar para novo gasto" description="Disponível na tela Início."><template #icon><Move3d :size="18" class="text-brand" /></template><template #control><AppSwitch :model-value="store.preferences.shakeToExpenseEnabled" label="Agitar para novo gasto" :disabled="sensorBusy" @update:model-value="toggleShake" /></template></SettingsRow>
            <SettingsRow label="Sensibilidade"><template #control><select :value="store.preferences.shakeSensitivity" class="h-10 rounded-xl border border-line bg-canvas px-2 text-sm" @click.stop @change="store.updatePreferences({ shakeSensitivity: ($event.target as HTMLSelectElement).value as ShakeSensitivity })"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></template></SettingsRow>
            <SettingsRow label="Saudação pelo horário"><template #control><AppSwitch :model-value="store.preferences.greetingEnabled" label="Saudação pelo horário" @update:model-value="updateBoolean('greetingEnabled', $event)" /></template></SettingsRow>
            <SettingsRow label="Radar de gastos diários"><template #icon><Gauge :size="18" class="text-brand" /></template><template #control><AppSwitch :model-value="store.preferences.dailySpendingAlertsEnabled" label="Radar de gastos diários" @update:model-value="updateBoolean('dailySpendingAlertsEnabled', $event)" /></template></SettingsRow>
            <SettingsRow label="Modo de economia"><template #icon><BatteryCharging :size="18" class="text-brand" /></template><template #control><AppSwitch :model-value="store.preferences.economyMode" label="Modo de economia" @update:model-value="updateBoolean('economyMode', $event)" /></template></SettingsRow>
            <SettingsRow label="Duração dos avisos"><template #control><select :value="store.preferences.feedbackDurationMs" class="h-10 rounded-xl border border-line bg-canvas px-2 text-sm" @click.stop @change="store.updatePreferences({ feedbackDurationMs: Number(($event.target as HTMLSelectElement).value) as FeedbackDurationMs })"><option :value="3000">3 s</option><option :value="4000">4 s</option><option :value="5000">5 s</option></select></template></SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Tela inicial">
            <SettingsRow v-for="widget in store.dashboardLayout.widgets" :key="widget.id" :label="DASHBOARD_WIDGETS[widget.id].label" :description="DASHBOARD_WIDGETS[widget.id].description"><template #control><AppSwitch :model-value="widget.visible" :label="`Mostrar ${DASHBOARD_WIDGETS[widget.id].label}`" @update:model-value="toggleWidget(widget.id, $event)" /></template></SettingsRow>
            <SettingsRow label="Restaurar layout original" clickable @activate="resetHome"><template #icon><RefreshCw :size="18" class="text-brand" /></template></SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Dados e segurança">
            <SettingsRow label="Backup local" :value="exporting ? 'Preparando…' : ''" clickable @activate="downloadBackup"><template #icon><Download :size="18" class="text-brand" /></template></SettingsRow>
            <SettingsRow label="Exportar CSV" :value="exportingCsv ? 'Preparando…' : ''" clickable @activate="downloadCsv"><template #icon><FileDown :size="18" class="text-brand" /></template></SettingsRow>
            <SettingsRow label="Restaurar backup" description="Substitui os dados atuais após sua confirmação." clickable @activate="backupInput?.click()"><template #icon><Upload :size="18" class="text-brand" /></template></SettingsRow>
            <input ref="backupInput" type="file" accept="application/json,.json" class="sr-only" aria-label="Selecionar backup do Pingo" @change="chooseBackup" />
            <SettingsRow label="Bloqueio do aplicativo" :value="isTauriRuntime() ? 'Em preparação' : 'Não disponível na Web'" disabled><template #icon><LockKeyhole :size="18" class="text-subtle" /></template></SettingsRow>
            <SettingsRow label="Reset total" description="Apaga permanentemente dados, preferências e automações deste dispositivo." danger clickable @activate="confirmingReset = true"><template #icon><RotateCcw :size="18" /></template></SettingsRow>
          </SettingsGroup>
        </div>

        <aside class="grid gap-5 xl:sticky xl:top-8">
          <ProfileCard :name="displayName" @edit="profileDraft = store.preferences.displayName; editingProfile = true" />
          <article class="pingo-card p-5"><div class="flex items-center gap-3"><span class="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand"><HardDrive :size="20" /></span><div><h2 class="font-extrabold">{{ isTauriRuntime() ? 'SQLite local' : 'Dados neste navegador' }}</h2><p class="text-xs text-subtle">Seus dados permanecem no aparelho.</p></div></div><div class="mt-5 grid gap-3 text-sm"><p class="flex items-center gap-2"><ShieldCheck :size="17" class="text-brand" /> Importações processadas localmente</p><p class="flex items-center gap-2"><Database :size="17" class="text-brand" /> Sem conexão bancária automática</p><p class="flex items-center gap-2"><Smartphone :size="17" class="text-brand" /> Pingo 0.11.0</p></div></article>
          <article class="rounded-pingo-lg bg-hero p-5 text-white"><Eye :size="20" class="text-violet-300" /><h2 class="mt-4 font-extrabold">Privacidade primeiro</h2><p class="mt-1 text-sm leading-relaxed text-white/55">Backup e extratos contêm informações financeiras. Guarde os arquivos em um local protegido.</p></article>
        </aside>
      </div>
    </main>
  </div>

  <Teleport to="body">
    <div v-if="editingProfile" class="fixed inset-0 z-[110] grid place-items-end bg-black/50 sm:place-items-center sm:p-4" @click.self="editingProfile = false">
      <form class="w-full rounded-t-[2rem] bg-surface p-5 shadow-float sm:max-w-md sm:rounded-[2rem]" @submit.prevent="saveProfile"><div class="flex items-center justify-between"><div><p class="text-sm font-semibold text-brand">Perfil</p><h2 class="text-2xl font-extrabold">Como chamar você?</h2></div><button type="button" class="grid size-11 place-items-center rounded-full bg-muted" aria-label="Fechar" @click="editingProfile = false"><X :size="18" /></button></div><label class="mt-6 grid gap-2 text-sm font-semibold">Nome<input v-model="profileDraft" maxlength="60" autocomplete="name" class="h-12 rounded-xl border border-line bg-canvas px-4" placeholder="Seu nome" /></label><button class="mt-5 min-h-12 w-full rounded-2xl bg-brand font-bold text-white">Salvar perfil</button></form>
    </div>
  </Teleport>
  <FactoryResetDialog v-if="confirmingReset" :busy="resetting" @cancel="confirmingReset = false" @confirm="factoryReset" />
  <ConfirmDialog v-if="pendingBackup" title="Restaurar este backup?" message="Os dados atuais deste dispositivo serão substituídos pelo conteúdo do arquivo. Faça um backup atual antes de continuar." confirm-label="Restaurar dados" :busy="restoringBackup" @cancel="pendingBackup = null" @confirm="confirmRestoreBackup" />
</template>
