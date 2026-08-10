import type { Category } from '../types/finance'

const createdAt = new Date().toISOString()

export const defaultCategories: Category[] = [
  { id: 'home', name: 'Casa', icon: 'house', color: '#0f766e', createdAt },
  { id: 'food', name: 'Alimentação', icon: 'utensils', color: '#ea580c', createdAt },
  { id: 'transport', name: 'Transporte', icon: 'bus', color: '#2563eb', createdAt },
  { id: 'leisure', name: 'Lazer', icon: 'gamepad-2', color: '#7c3aed', createdAt },
]
