<script setup lang="ts">
import { CreditCard, FileUp, X } from 'lucide-vue-next'
import AppModal from './AppModal.vue'
const emit = defineEmits<{ close: []; card: []; live: [] }>()
</script>

<template>
  <AppModal aria-labelledby="wallet-entry-title" root-class="z-[85]" panel-class="p-5 sm:max-w-md sm:p-6" @close="emit('close')">
    <div class="flex items-start justify-between"><div><p class="text-sm font-bold text-brand">Novo na carteira</p><h2 id="wallet-entry-title" class="text-xl font-black">O que deseja adicionar?</h2></div><button class="pingo-modal-close" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button></div><div class="mt-5 grid gap-3"><button class="btn h-auto min-h-20 justify-start gap-4 rounded-2xl border-line bg-surface p-4 text-left hover:border-brand" @click="emit('card')"><span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><CreditCard :size="22" /></span><span><strong class="block">Cartão de débito</strong><span class="mt-1 block whitespace-normal text-xs font-normal leading-relaxed text-subtle">Apelido, banco, últimos quatro dígitos, limite e aparência.</span></span></button><button class="btn h-auto min-h-20 justify-start gap-4 rounded-2xl border-line bg-surface p-4 text-left hover:border-brand" @click="emit('live')"><span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><FileUp :size="22" /></span><span><strong class="block">Ingresso, documento ou QR</strong><span class="mt-1 block whitespace-normal text-xs font-normal leading-relaxed text-subtle">Um cartão ao vivo com imagem ou PDF disponível offline.</span></span></button></div>
  </AppModal>
</template>
