<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-vue-next'
import { useFinanceStore } from '../stores/financeStore'
import type { TransactionFilters, TransactionType } from '../types/finance'

const store = useFinanceStore()
const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('pt-BR', { month: 'long' })
    .format(new Date(2026, index, 1)).replace(/^./, (letter) => letter.toUpperCase()),
}))
const years = computed(() => [...new Set(store.transactions.map((item) => Number(item.date.slice(0, 4))))]
  .filter(Number.isFinite)
  .sort((a, b) => b - a))
const availableCategories = computed(() => store.categories.filter((category) =>
  !store.filters.kind || category.kind === store.filters.kind))

function update(patch: Partial<TransactionFilters>) {
  const next = { ...store.filters, ...patch }
  for (const key of Object.keys(next) as (keyof TransactionFilters)[]) {
    if (next[key] === '' || next[key] === undefined) delete next[key]
  }
  if (patch.kind && store.filters.categoryId) {
    const category = store.categories.find((item) => item.id === store.filters.categoryId)
    if (category?.kind !== patch.kind) delete next.categoryId
  }
  store.setFilters(next)
}

function numberValue(value: string) { return value ? Number(value) : undefined }
</script>

<template>
  <section class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
    <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><SlidersHorizontal :size="14" /> Buscar e filtrar</div>
    <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_.65fr_.65fr_.9fr_auto]">
      <label class="relative block">
        <span class="sr-only">Buscar transação</span>
        <Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
        <input :value="store.filters.query ?? ''" type="search" placeholder="Descrição, categoria ou cartão" class="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900" @input="update({ query: ($event.target as HTMLInputElement).value })" />
      </label>
      <label><span class="sr-only">Tipo</span><select :value="store.filters.kind ?? ''" class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900" @change="update({ kind: (($event.target as HTMLSelectElement).value || undefined) as TransactionType | undefined })"><option value="">Entradas e despesas</option><option value="expense">Só despesas</option><option value="income">Só entradas</option></select></label>
      <label><span class="sr-only">Mês</span><select :value="store.filters.month ?? ''" class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900" @change="update({ month: numberValue(($event.target as HTMLSelectElement).value) })"><option value="">Todos os meses</option><option v-for="month in months" :key="month.value" :value="month.value">{{ month.label }}</option></select></label>
      <label><span class="sr-only">Categoria</span><select :value="store.filters.categoryId ?? ''" class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900" @change="update({ categoryId: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Todas as categorias</option><option v-for="category in availableCategories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
      <button v-if="store.hasActiveFilters" class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" @click="store.setFilters({})"><RotateCcw :size="15" /> Limpar</button>
    </div>
    <div v-if="years.length > 1" class="mt-2 flex flex-wrap gap-2"><button class="rounded-full px-3 py-1 text-xs font-bold" :class="store.filters.year === undefined ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white dark:bg-slate-900'" @click="update({ year: undefined })">Todos os anos</button><button v-for="year in years" :key="year" class="rounded-full px-3 py-1 text-xs font-bold" :class="store.filters.year === year ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white dark:bg-slate-900'" @click="update({ year })">{{ year }}</button></div>
  </section>
</template>
