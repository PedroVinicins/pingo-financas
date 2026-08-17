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
        class="fixed inset-x-4 bottom-[calc(7.75rem+env(safe-area-inset-bottom))] z-[120] mx-auto flex max-w-md items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl dark:bg-slate-900 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-24 sm:mx-0 sm:w-[min(26rem,calc(100vw-3rem))]"
        :class="{
          'border-emerald-200 dark:border-emerald-900': store.feedback.tone === 'success',
          'border-rose-200 dark:border-rose-900': store.feedback.tone === 'error',
          'border-sky-200 dark:border-sky-900': store.feedback.tone === 'info',
        }"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 v-if="store.feedback.tone === 'success'" class="mt-0.5 shrink-0 text-emerald-600" :size="20" />
        <AlertTriangle v-else-if="store.feedback.tone === 'error'" class="mt-0.5 shrink-0 text-rose-600" :size="20" />
        <Info v-else class="mt-0.5 shrink-0 text-sky-600" :size="20" />
        <p class="min-w-0 flex-1 text-sm font-bold leading-relaxed">{{ store.feedback.message }}</p>
        <button class="grid size-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar aviso" @click="store.clearFeedback"><X :size="16" /></button>
      </aside>
    </Transition>
  </Teleport>
</template>
