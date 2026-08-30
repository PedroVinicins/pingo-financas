<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useFinanceStore } from '../stores/financeStore'

const store = useFinanceStore()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0 sm:translate-y-0 sm:translate-x-3"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-3 opacity-0 sm:translate-y-0 sm:translate-x-3"
    >
      <aside
        v-if="store.feedback"
        :key="store.feedback.id"
        class="fixed inset-x-4 bottom-[calc(7.75rem+env(safe-area-inset-bottom))] z-[220] mx-auto flex max-w-md items-start gap-3 overflow-hidden rounded-[1.35rem] border bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,.22)] dark:bg-slate-900 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-24 sm:mx-0 sm:w-[min(26rem,calc(100vw-3rem))]"
        :class="{
          'border-emerald-200 bg-emerald-50/95 dark:border-emerald-900 dark:bg-emerald-950/90': store.feedback.tone === 'success',
          'border-rose-200 bg-rose-50/95 dark:border-rose-900 dark:bg-rose-950/90': store.feedback.tone === 'error',
          'border-sky-200 bg-sky-50/95 dark:border-sky-900 dark:bg-sky-950/90': store.feedback.tone === 'info',
        }"
        role="status"
        aria-live="polite"
      >
        <span class="grid size-10 shrink-0 place-items-center rounded-2xl" :class="{ 'bg-emerald-600 text-white': store.feedback.tone === 'success', 'bg-rose-600 text-white': store.feedback.tone === 'error', 'bg-sky-600 text-white': store.feedback.tone === 'info' }"><CheckCircle2 v-if="store.feedback.tone === 'success'" :size="20" /><AlertTriangle v-else-if="store.feedback.tone === 'error'" :size="20" /><Info v-else :size="20" /></span>
        <span class="min-w-0 flex-1"><strong class="block text-sm font-black">{{ store.feedback.title ?? (store.feedback.tone === 'success' ? 'Concluído' : store.feedback.tone === 'error' ? 'Não foi possível concluir' : 'Pingo avisa') }}</strong><p class="mt-0.5 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-200">{{ store.feedback.message }}</p></span>
        <button class="grid size-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800" aria-label="Fechar aviso" @click="store.clearFeedback"><X :size="16" /></button>
      </aside>
    </Transition>
  </Teleport>
</template>
