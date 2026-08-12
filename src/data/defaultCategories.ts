import type { Category } from '../types/finance'

const createdAt = new Date().toISOString()

export const defaultCategories: Category[] = [
  { id: 'home', kind: 'expense', name: 'Casa', icon: 'house', color: '#0f766e', createdAt },
  { id: 'food', kind: 'expense', name: 'Alimentação', icon: 'utensils', color: '#ea580c', createdAt },
  { id: 'transport', kind: 'expense', name: 'Transporte', icon: 'bus', color: '#2563eb', createdAt },
  { id: 'leisure', kind: 'expense', name: 'Lazer', icon: 'gamepad-2', color: '#7c3aed', createdAt },
  { id: 'health', kind: 'expense', name: 'Saúde', icon: 'heart-pulse', color: '#e11d48', createdAt },
  { id: 'education', kind: 'expense', name: 'Educação', icon: 'graduation-cap', color: '#0891b2', createdAt },
  { id: 'bills', kind: 'expense', name: 'Contas', icon: 'receipt-text', color: '#ca8a04', createdAt },
  { id: 'shopping', kind: 'expense', name: 'Compras', icon: 'shopping-bag', color: '#db2777', createdAt },
  { id: 'salary', kind: 'income', name: 'Salário', icon: 'badge-dollar-sign', color: '#059669', createdAt },
  { id: 'freelance', kind: 'income', name: 'Freelance', icon: 'laptop', color: '#0d9488', createdAt },
  { id: 'extra-work', kind: 'income', name: 'Trabalho extra', icon: 'briefcase-business', color: '#2563eb', createdAt },
  { id: 'sales', kind: 'income', name: 'Vendas', icon: 'store', color: '#7c3aed', createdAt },
  { id: 'benefits', kind: 'income', name: 'Benefícios', icon: 'gift', color: '#ea580c', createdAt },
  { id: 'income-yield', kind: 'income', name: 'Rendimentos', icon: 'trending-up', color: '#16a34a', createdAt },
  { id: 'other-income', kind: 'income', name: 'Outras entradas', icon: 'circle-dollar-sign', color: '#475569', createdAt },
]
