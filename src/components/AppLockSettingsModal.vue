<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Trash2, X } from 'lucide-vue-next'
import AppSwitch from './AppSwitch.vue'
import {
  announceAppLockChange, changeAppLockPin, configureAppLock, disableAppLock,
  authenticateAppLockBiometric, biometricErrorMessage, getAppLockConfig, getBiometricAvailability,
  setAppLockBiometric, validateAppLockPin,
  type AppLockConfig,
} from '../services/appLock'

const emit = defineEmits<{ close: []; changed: [config: AppLockConfig] }>()
const config = ref<AppLockConfig>({ enabled: false, biometricEnabled: false })
const biometricAvailable = ref(false)
const biometricLabel = ref('Biometria')
const biometricReason = ref('Conferindo a segurança do aparelho…')
const biometricDraft = ref(false)
const pin = ref('')
const confirmation = ref('')
const currentPin = ref('')
const newPin = ref('')
const newPinConfirmation = ref('')
const changingPin = ref(false)
const busy = ref(false)
const loading = ref(true)
const error = ref('')

const canEnable = computed(() => validateAppLockPin(pin.value) && pin.value === confirmation.value && !busy.value)
const hasChanges = computed(() => changingPin.value || biometricDraft.value !== config.value.biometricEnabled)
const canSave = computed(() => hasChanges.value && validateAppLockPin(currentPin.value)
  && (!changingPin.value || (validateAppLockPin(newPin.value) && newPin.value === newPinConfirmation.value))
  && !busy.value)

function onlyDigits(value: string) { return value.replace(/\D/g, '').slice(0, 6) }
function publish(next: AppLockConfig) {
  config.value = next
  biometricDraft.value = next.biometricEnabled
  announceAppLockChange(next)
  emit('changed', next)
}
async function confirmSystemBiometric() {
  try { await authenticateAppLockBiometric() }
  catch (cause) { throw new Error(biometricErrorMessage(cause, biometricLabel.value)) }
}

async function enable() {
  error.value = ''
  if (!canEnable.value) { error.value = 'Use de 4 a 6 números e repita o mesmo PIN.'; return }
  busy.value = true
  try {
    const enableBiometric = biometricAvailable.value && biometricDraft.value
    if (enableBiometric) await confirmSystemBiometric()
    publish(await configureAppLock(pin.value, enableBiometric)); pin.value = ''; confirmation.value = ''
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { busy.value = false }
}

async function save() {
  error.value = ''
  if (!canSave.value) { error.value = 'Confirme o PIN atual e confira o novo PIN.'; return }
  busy.value = true
  try {
    let credential = currentPin.value
    let next = config.value
    if (changingPin.value) {
      next = await changeAppLockPin(currentPin.value, newPin.value)
      credential = newPin.value
    }
    if (biometricDraft.value !== next.biometricEnabled) {
      if (biometricDraft.value) await confirmSystemBiometric()
      next = await setAppLockBiometric(credential, biometricDraft.value)
    }
    publish(next)
    currentPin.value = ''; newPin.value = ''; newPinConfirmation.value = ''; changingPin.value = false
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { busy.value = false }
}

async function disable() {
  error.value = ''
  if (!validateAppLockPin(currentPin.value)) { error.value = 'Informe seu PIN atual para desativar.'; return }
  busy.value = true
  try { publish(await disableAppLock(currentPin.value)); currentPin.value = '' }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { busy.value = false }
}

onMounted(async () => {
  try {
    const [stored, biometric] = await Promise.all([getAppLockConfig(), getBiometricAvailability()])
    config.value = stored
    biometricAvailable.value = biometric.available
    biometricLabel.value = biometric.label
    biometricReason.value = biometric.reason
    biometricDraft.value = stored.biometricEnabled
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { loading.value = false }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[130] grid place-items-end bg-slate-950/65 backdrop-blur-[2px] sm:place-items-center sm:p-4" @click.self="!busy && emit('close')">
      <section class="min-w-0 w-full max-w-full rounded-t-[2rem] bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="app-lock-settings-title">
        <header class="flex min-w-0 items-start gap-3"><span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><LockKeyhole :size="21" /></span><div class="min-w-0 flex-1"><p class="text-sm font-bold text-brand">Privacidade local</p><h2 id="app-lock-settings-title" class="break-words text-xl font-extrabold">Bloqueio do aplicativo</h2></div><button :disabled="busy" class="grid size-10 shrink-0 place-items-center rounded-xl bg-muted" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></header>

        <div v-if="loading" class="grid min-h-48 place-items-center text-sm font-bold text-subtle">Conferindo a proteção…</div>
        <form v-else-if="!config.enabled" class="mt-6 grid min-w-0 gap-4" @submit.prevent="enable">
          <p class="text-sm leading-relaxed text-subtle">Crie um PIN numérico. Ele será exigido ao abrir o Pingo e depois de 30 segundos em segundo plano.</p>
          <label class="grid min-w-0 gap-1.5 text-sm font-bold">Novo PIN (4 a 6 números)<input :value="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" class="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-center text-xl tracking-[0.35em]" @input="pin = onlyDigits(($event.target as HTMLInputElement).value)" /></label>
          <label class="grid min-w-0 gap-1.5 text-sm font-bold">Repetir PIN<input :value="confirmation" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" class="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-center text-xl tracking-[0.35em]" @input="confirmation = onlyDigits(($event.target as HTMLInputElement).value)" /></label>
          <div class="flex items-center gap-3 rounded-2xl bg-muted p-4"><Fingerprint :size="20" class="shrink-0 text-brand" /><div class="min-w-0 flex-1"><p class="font-bold">Usar {{ biometricLabel }}</p><p class="text-xs text-subtle">{{ biometricAvailable ? 'Será confirmada agora pelo Android. O PIN continuará disponível.' : biometricReason }}</p></div><AppSwitch v-if="biometricAvailable" v-model="biometricDraft" :label="`Usar ${biometricLabel}`" /></div>
          <p v-if="error" class="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{{ error }}</p>
          <button :disabled="!canEnable" class="min-h-12 cursor-pointer rounded-2xl bg-brand px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck :size="18" class="mr-1.5 inline" />{{ busy ? 'Ativando…' : 'Ativar bloqueio' }}</button>
          <p class="text-center text-xs text-subtle">O PIN não pode ser recuperado. Sem ele, será necessário limpar os dados locais do aplicativo.</p>
        </form>

        <form v-else class="mt-6 grid min-w-0 gap-4" @submit.prevent="save">
          <div class="rounded-2xl bg-brand-soft p-4"><p class="flex items-center gap-2 font-extrabold text-brand"><ShieldCheck :size="18" /> Proteção ativa</p><p class="mt-1 text-xs leading-relaxed text-subtle">Seu conteúdo é coberto ao sair do app e bloqueado após 30 segundos.</p></div>
          <label class="grid min-w-0 gap-1.5 text-sm font-bold">PIN atual<input :value="currentPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" class="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-center text-xl tracking-[0.35em]" @input="currentPin = onlyDigits(($event.target as HTMLInputElement).value)" /></label>
          <div class="flex items-center gap-3 rounded-2xl bg-muted p-4"><Fingerprint :size="20" class="shrink-0 text-brand" /><div class="min-w-0 flex-1"><p class="font-bold">{{ biometricLabel }}</p><p class="text-xs text-subtle">{{ biometricAvailable ? 'Ao ativar, o Android pedirá uma confirmação biométrica real.' : biometricReason }}</p></div><AppSwitch v-model="biometricDraft" :label="`Usar ${biometricLabel}`" :disabled="!biometricAvailable && !config.biometricEnabled" /></div>
          <button type="button" class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-left text-sm font-bold text-brand hover:bg-brand-soft" @click="changingPin = !changingPin"><KeyRound :size="17" />{{ changingPin ? 'Manter PIN atual' : 'Alterar PIN' }}</button>
          <template v-if="changingPin"><label class="grid min-w-0 gap-1.5 text-sm font-bold">Novo PIN<input :value="newPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" class="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-center text-xl tracking-[0.35em]" @input="newPin = onlyDigits(($event.target as HTMLInputElement).value)" /></label><label class="grid min-w-0 gap-1.5 text-sm font-bold">Repetir novo PIN<input :value="newPinConfirmation" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" class="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-center text-xl tracking-[0.35em]" @input="newPinConfirmation = onlyDigits(($event.target as HTMLInputElement).value)" /></label></template>
          <p v-if="error" class="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{{ error }}</p>
          <button :disabled="!canSave" class="min-h-12 cursor-pointer rounded-2xl bg-brand px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">{{ busy ? 'Salvando…' : 'Salvar proteção' }}</button>
          <button type="button" :disabled="busy || !validateAppLockPin(currentPin)" class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-200 font-extrabold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:hover:bg-rose-950/20" @click="disable"><Trash2 :size="17" /> Desativar bloqueio</button>
        </form>
      </section>
    </div>
  </Teleport>
</template>
