<script setup lang="ts">
import { CreditCard, FileUp, X } from 'lucide-vue-next'
const emit = defineEmits<{ close: []; card: []; live: [] }>()
</script>

<template>
  <div class="fixed inset-0 z-[85] flex items-end bg-slate-950/55 sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <section class="w-full rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="wallet-entry-title"><div class="flex items-start justify-between"><div><p class="text-sm font-bold text-violet-600">Novo na carteira</p><h2 id="wallet-entry-title" class="text-xl font-black">O que deseja adicionar?</h2></div><button class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></div><div class="mt-5 grid gap-3"><button class="flex items-start gap-4 rounded-2xl border border-slate-200 p-4 text-left hover:border-emerald-400 dark:border-slate-800" @click="emit('card')"><span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950"><CreditCard :size="22" /></span><span><strong class="block">Cartão de débito</strong><span class="mt-1 block text-xs leading-relaxed text-slate-500">Apelido, banco, últimos quatro dígitos, limite e aparência.</span></span></button><button class="flex items-start gap-4 rounded-2xl border border-slate-200 p-4 text-left hover:border-violet-400 dark:border-slate-800" @click="emit('live')"><span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950"><FileUp :size="22" /></span><span><strong class="block">Ingresso, documento ou QR</strong><span class="mt-1 block text-xs leading-relaxed text-slate-500">Um cartão ao vivo com imagem ou PDF disponível offline.</span></span></button></div></section>
  </div>
</template>
