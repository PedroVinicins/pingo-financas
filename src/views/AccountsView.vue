<script setup lang="ts">
import { ref, watch } from 'vue'
import { CreditCard, PiggyBank } from 'lucide-vue-next'
import WalletView from './WalletView.vue'
import VaultsView from './VaultsView.vue'

const props = withDefaults(defineProps<{ focusCardId?: string; initialSection?: 'wallet' | 'vaults' }>(), { initialSection: 'wallet' })
const emit = defineEmits<{ quickExpense: [cardId?: string] }>()
const section = ref<'wallet' | 'vaults'>(props.initialSection)
watch(() => props.initialSection, (value) => { section.value = value })
</script>

<template>
  <div>
    <div class="sticky top-0 z-20 mx-auto max-w-[1260px] bg-canvas/90 px-5 pb-1 pt-[calc(.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-8 lg:top-0 lg:px-12 lg:pt-5">
      <div class="soft-shadow inline-grid grid-cols-2 rounded-2xl border border-line bg-muted p-1" role="tablist" aria-label="Seções de contas">
        <button class="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold" :class="section === 'wallet' ? 'bg-surface text-brand shadow-sm' : 'text-subtle'" role="tab" :aria-selected="section === 'wallet'" @click="section = 'wallet'"><CreditCard :size="17" /> Carteira</button>
        <button class="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold" :class="section === 'vaults' ? 'bg-surface text-brand shadow-sm' : 'text-subtle'" role="tab" :aria-selected="section === 'vaults'" @click="section = 'vaults'"><PiggyBank :size="17" /> Porquinhos</button>
      </div>
    </div>
    <WalletView v-if="section === 'wallet'" :focus-card-id="focusCardId" @quick-expense="emit('quickExpense', $event)" />
    <VaultsView v-else />
  </div>
</template>
