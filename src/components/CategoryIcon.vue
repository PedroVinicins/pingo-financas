<script setup lang="ts">
import { computed } from 'vue'
import {
  BadgeDollarSign, Banknote, BriefcaseBusiness, Bus, CircleDollarSign, Gamepad, Gamepad2, Gift,
  GraduationCap, HeartPulse, House, Laptop, ReceiptText, ShoppingBag, Store,
  Tag, TrendingUp, Utensils, Wifi,
} from 'lucide-vue-next'
import type { Category, TransactionType } from '../types/finance'

const props = withDefaults(defineProps<{
  category?: Pick<Category, 'name' | 'icon' | 'color'> | null
  kind?: TransactionType
  size?: number
}>(), { category: null, kind: 'expense', size: 18 })

const iconByName = {
  house: House,
  utensils: Utensils,
  bus: Bus,
  'gamepad-2': Gamepad2,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'receipt-text': ReceiptText,
  'shopping-bag': ShoppingBag,
  'badge-dollar-sign': BadgeDollarSign,
  laptop: Laptop,
  'briefcase-business': BriefcaseBusiness,
  store: Store,
  gift: Gift,
  'trending-up': TrendingUp,
  'circle-dollar-sign': CircleDollarSign,
  banknote: Banknote,
  gamepad: Gamepad,
  wifi: Wifi,
  tag: Tag,
} as const

const icon = computed(() => iconByName[props.category?.icon as keyof typeof iconByName]
  ?? (props.kind === 'income' ? CircleDollarSign : Tag))
const color = computed(() => props.category?.color || (props.kind === 'income' ? '#059669' : '#7C3AED'))
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-xl"
    :style="{ width: `${size + 18}px`, height: `${size + 18}px`, color, backgroundColor: `${color}1A` }"
    :title="category?.name ?? 'Sem categoria'"
    aria-hidden="true"
  >
    <component :is="icon" :size="size" :stroke-width="2.1" />
  </span>
</template>
