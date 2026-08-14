<script setup lang="ts">
import { ref } from 'vue'
import { Database, Download, HardDrive, ShieldCheck, Smartphone, X } from 'lucide-vue-next'
import { useFinanceStore } from '../stores/financeStore'
import { exportBackup } from '../services/backup'
import { isTauriRuntime } from '../services/financeRepository'

const emit = defineEmits<{ close: [] }>()
const store = useFinanceStore()
const exporting = ref(false)

async function downloadBackup() {
  exporting.value = true
  try {
    await exportBackup({
      transactions: [...store.transactions],
      categories: [...store.categories],
      debitCards: [...store.debitCards],
      vaults: [...store.vaults],
      vaultMovements: [...store.vaultMovements],
      automaticReserveRules: [...store.automaticReserveRules],
      recurringRules: [...store.recurringRules],
      accountSettings: { ...store.accountSettings },
    })
    store.showFeedback('Backup gerado. Guarde o arquivo em um local seguro.', 'success')
  } catch (cause) { store.reportError(cause, 'Não foi possível gerar o backup.') }
  finally { exporting.value = false }
}
</script>

<template>
  <div class="fixed inset-0 z-[80] flex items-end bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" @click.self="emit('close')">
    <section class="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="app-settings-title">
      <div class="flex items-start justify-between gap-3"><div class="flex items-start gap-3"><div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Database :size="21" /></div><div><p class="text-sm font-bold text-sky-600">Dados e aplicativo</p><h2 id="app-settings-title" class="text-xl font-black">Configurações do Pingo</h2></div></div><button class="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="Fechar configurações" @click="emit('close')"><X :size="19" /></button></div>

      <div class="mt-5 grid gap-3">
        <article class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><HardDrive :size="20" class="mt-0.5 shrink-0 text-emerald-600" /><div><p class="text-sm font-black">{{ isTauriRuntime() ? 'SQLite no dispositivo' : 'Armazenamento deste navegador' }}</p><p class="mt-1 text-xs leading-relaxed text-slate-500">{{ isTauriRuntime() ? 'Transações, configurações, cofres e recorrências ficam juntos no banco local do aplicativo.' : 'Os dados ficam somente neste navegador. Limpar os dados do site também remove o histórico.' }}</p></div></article>
        <article class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><ShieldCheck :size="20" class="mt-0.5 shrink-0 text-violet-600" /><div><p class="text-sm font-black">Sem conexão bancária</p><p class="mt-1 text-xs leading-relaxed text-slate-500">O Pingo não acessa bancos, não sincroniza com servidor próprio e não movimenta dinheiro real.</p></div></article>
        <article class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><Smartphone :size="20" class="mt-0.5 shrink-0 text-amber-600" /><div><p class="text-sm font-black">Pingo 0.7.0</p><p class="mt-1 text-xs leading-relaxed text-slate-500">Release de confiabilidade, usabilidade e suporte offline.</p></div></article>
      </div>

      <section class="mt-5 rounded-2xl bg-slate-950 p-5 text-white dark:bg-slate-800"><div class="flex items-start gap-3"><Download :size="21" class="mt-0.5 shrink-0 text-emerald-300" /><div><h3 class="font-black">Faça uma cópia dos seus dados</h3><p class="mt-1 text-xs leading-relaxed text-slate-300">O arquivo inclui valores e descrições financeiras. Proteja-o como protegeria um extrato.</p></div></div><button :disabled="exporting" class="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-emerald-950 disabled:opacity-50" @click="downloadBackup">{{ exporting ? 'Preparando…' : 'Exportar backup em JSON' }}</button></section>

      <p class="mt-4 text-center text-[11px] leading-relaxed text-slate-400">O backup é gerado localmente. Nenhum dado é enviado pelo Pingo.</p>
    </section>
  </div>
</template>
