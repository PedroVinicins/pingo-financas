import type { Transaction } from '../types/finance'

const expenseMessages = [
  'Nossa, o dinheiro vai rápido, né? 😅',
  'Mal caiu e já está indo embora. Pelo menos agora está registrado!',
  'Mais uma compra domesticada pelo Pingo. 🧾',
  'Foi um gasto ou uma experiência premium? 👀',
  'Pix feito, coração tranquilo… saldo nem tanto. 🫠',
  'Seu dinheiro pediu férias e foi embora sem avisar. ✈️',
  'Anotado! Fingir que não gastou agora ficou mais difícil. 😌',
]

const incomeMessages = [
  'Opa, pingou! Você já pagou as dívidas? 💸',
  'Dinheiro na conta! Sobrou o quê? Pro beta? 😅',
  'A conta respirou. Agora trate esse saldo com carinho!',
  'Caiu dinheiro! Um pingo no cofre não faz mal a ninguém. 🐷',
  'O saldo cresceu! Não assusta ele com um carrinho cheio agora. 🛒',
  'Dinheiro detectado. O Pingo recomenda distância de promoções suspeitas. 👀',
]

export function pingoMessageForTransaction(transaction: Transaction, availableBalanceCents: bigint) {
  const messages = transaction.kind === 'income' ? incomeMessages : expenseMessages
  const seed = [...transaction.id].reduce((total, character) => total + character.charCodeAt(0), 0)
  if (transaction.kind === 'expense' && availableBalanceCents === 0n) {
    return 'Ufa, chegou no limite certinho. Agora segura a carteira: o Pingo não deixa ficar negativo. 🛑'
  }
  if (transaction.kind === 'expense' && availableBalanceCents <= 5_000n) {
    return 'Saldo no modo miojo: ainda dá, mas precisa de cuidado e água quente. 🍜'
  }
  return messages[seed % messages.length]
}
