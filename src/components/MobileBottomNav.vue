<script setup lang="ts">
import { BarChart3, House, Settings2, WalletCards } from 'lucide-vue-next'

export type PrimaryView = 'accounts' | 'home' | 'analytics' | 'settings'

defineProps<{ activeView: PrimaryView }>()
const emit = defineEmits<{ navigate: [view: PrimaryView] }>()

const items = [
  { id: 'accounts' as const, label: 'Contas', icon: WalletCards },
  { id: 'home' as const, label: 'Início', icon: House },
  { id: 'analytics' as const, label: 'Análises', icon: BarChart3 },
  { id: 'settings' as const, label: 'Ajustes', icon: Settings2 },
]
</script>

<template>
  <nav class="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-4 rounded-[1.65rem] border border-line/90 bg-surface/95 p-2 shadow-float backdrop-blur-xl lg:hidden" aria-label="Navegação principal">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="pingo-interactive grid min-h-12 min-w-0 place-items-center content-center gap-1 rounded-2xl px-1 text-[10px] font-semibold"
      :class="activeView === item.id ? 'bg-brand-soft text-brand shadow-sm' : 'text-subtle'"
      :aria-current="activeView === item.id ? 'page' : undefined"
      @click="emit('navigate', item.id)"
    >
      <component :is="item.icon" :size="19" :stroke-width="activeView === item.id ? 2.4 : 1.8" />
      <span class="truncate">{{ item.label }}</span>
    </button>
  </nav>
</template>
