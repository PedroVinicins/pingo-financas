<script setup lang="ts">
import { BarChart3, House, Plus, Settings2, UserRound, WalletCards } from 'lucide-vue-next'
import type { PrimaryView } from './MobileBottomNav.vue'

defineProps<{ activeView: PrimaryView; displayName: string }>()
const emit = defineEmits<{ navigate: [view: PrimaryView]; add: [] }>()

const items = [
  { id: 'accounts' as const, label: 'Contas', icon: WalletCards },
  { id: 'home' as const, label: 'Início', icon: House },
  { id: 'analytics' as const, label: 'Análises', icon: BarChart3 },
  { id: 'settings' as const, label: 'Ajustes', icon: Settings2 },
]
</script>

<template>
  <aside class="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-line bg-surface px-4 py-6 lg:flex lg:flex-col">
    <button class="flex min-h-12 items-center gap-3 rounded-2xl px-2 text-left" aria-label="Ir para o início" @click="emit('navigate', 'home')">
      <img src="/pingo-icon.svg" alt="" class="size-10 rounded-2xl" />
      <span><strong class="block text-base tracking-tight">Pingo</strong><span class="block text-xs font-medium text-subtle">Finanças</span></span>
    </button>

    <button class="pingo-interactive mt-8 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-4 font-bold text-white shadow-lg shadow-violet-500/20" @click="emit('add')">
      <Plus :size="19" /> Nova transação
    </button>

    <nav class="mt-7 grid gap-1" aria-label="Navegação principal">
      <button
        v-for="item in items"
        :key="item.id"
        class="pingo-interactive flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold"
        :class="activeView === item.id ? 'bg-brand-soft text-brand' : 'text-subtle hover:bg-muted hover:text-ink'"
        :aria-current="activeView === item.id ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" :size="19" /> {{ item.label }}
      </button>
    </nav>

    <button class="mt-auto flex min-h-14 items-center gap-3 rounded-2xl bg-muted px-3 text-left" @click="emit('navigate', 'settings')">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand"><UserRound :size="17" /></span>
      <span class="min-w-0"><strong class="block truncate text-sm">{{ displayName }}</strong><span class="block text-xs text-subtle">Editar perfil</span></span>
    </button>
  </aside>
</template>
