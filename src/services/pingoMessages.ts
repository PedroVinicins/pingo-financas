import type { Transaction } from '../types/finance'

const expenseMessages = [
  'Nossa, o dinheiro vai rápido, né? 😅',
  'Mal caiu e já está indo embora. Pelo menos agora está registrado!',
  'Mais uma compra domesticada pelo Pingo. 🧾',
  'Foi um gasto ou uma experiência premium? 👀',
]

const incomeMessages = [
  'Opa, pingou! Você já pagou as dívidas? 💸',
  'Dinheiro na conta! Sobrou o quê? Pro beta? 😅',
  'A conta respirou. Agora trate esse saldo com carinho!',
  'Caiu dinheiro! Um pingo no cofre não faz mal a ninguém. 🐷',
]

export function pingoMessageForTransaction(transaction: Transaction, availableBalanceCents: bigint) {
  const messages = transaction.kind === 'income' ? incomeMessages : expenseMessages
  const seed = [...transaction.id].reduce((total, character) => total + character.charCodeAt(0), 0)
  if (transaction.kind === 'expense' && availableBalanceCents === 0n) {
    return 'Ufa, chegou no limite certinho. Agora segura a carteira: o Pingo não deixa ficar negativo. 🛑'
  }
  return messages[seed % messages.length]
}
