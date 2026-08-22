<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-vue-next'
import { validateAppLockPin } from '../services/appLock'

const props = defineProps<{
  biometricAvailable: boolean
  biometricLabel: string
  busy?: boolean
  error?: string
  retryAfterSeconds?: number
}>()
const emit = defineEmits<{ submit: [pin: string]; biometric: [] }>()
const pin = ref('')
const pinInput = ref<HTMLInputElement | null>(null)
const canSubmit = computed(() => validateAppLockPin(pin.value) && !props.busy && !props.retryAfterSeconds)

function submit() {
  if (!canSubmit.value) return
  emit('submit', pin.value)
}

watch(() => props.error, (error) => {
  if (!error) return
  pin.value = ''
  void nextTick(() => pinInput.value?.focus())
})
watch(() => props.retryAfterSeconds, (seconds) => {
  if (seconds) pin.value = ''
})
onMounted(() => pinInput.value?.focus())
</script>

<template>
  <main class="fixed inset-0 z-[200] grid min-h-dvh place-items-center overflow-y-auto bg-hero px-5 py-[calc(2rem+env(safe-area-inset-top))] text-white" aria-labelledby="app-lock-title">
    <section class="w-full max-w-sm text-center">
      <img src="/pingo-icon.svg" alt="" class="mx-auto size-20 rounded-[1.7rem] shadow-2xl" />
      <span class="mx-auto mt-7 grid size-12 place-items-center rounded-2xl bg-white/10 text-violet-300"><LockKeyhole :size="23" /></span>
      <h1 id="app-lock-title" class="mt-4 text-3xl font-extrabold tracking-tight">Pingo bloqueado</h1>
      <p class="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/60">Autentique-se para ver seus saldos, lançamentos e porquinhos.</p>

      <form class="mt-7 grid gap-3" @submit.prevent="submit">
        <label class="sr-only" for="app-lock-pin">PIN do Pingo</label>
        <input id="app-lock-pin" ref="pinInput" v-model="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" class="h-14 w-full rounded-2xl border border-white/15 bg-white/10 px-5 text-center text-2xl font-black tracking-[0.45em] text-white placeholder:text-white/25" placeholder="••••" :disabled="busy || Boolean(retryAfterSeconds)" @input="pin = pin.replace(/\D/g, '').slice(0, 6)" />
        <p v-if="retryAfterSeconds" class="rounded-xl bg-amber-400/15 p-3 text-sm font-bold text-amber-200" role="alert">Muitas tentativas. Tente novamente em {{ retryAfterSeconds }} s.</p>
        <p v-else-if="error" class="rounded-xl bg-rose-400/15 p-3 text-sm font-bold text-rose-200" role="alert">{{ error }}</p>
        <button :disabled="!canSubmit" class="min-h-13 cursor-pointer rounded-2xl bg-brand px-5 py-3.5 font-extrabold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">{{ busy ? 'Verificando…' : 'Desbloquear com PIN' }}</button>
      </form>

      <button v-if="biometricAvailable" :disabled="busy" class="mt-3 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 font-bold text-violet-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" @click="emit('biometric')"><Fingerprint :size="21" /> Usar {{ biometricLabel }}</button>
      <p class="mt-7 flex items-center justify-center gap-1.5 text-xs text-white/40"><ShieldCheck :size="14" /> Proteção local deste dispositivo</p>
    </section>
  </main>
</template>
