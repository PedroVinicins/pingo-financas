# Política de privacidade

O Pingo é um aplicativo local de organização financeira e não é um banco.

## Dados tratados

O aplicativo pode armazenar informações inseridas pelo próprio usuário, como transações, categorias, apelidos de cartões, porquinhos, metas e recorrências.

- O Pingo não solicita número completo do cartão, validade ou CVV.
- O Pingo não acessa contas bancárias nem movimenta dinheiro real.
- O projeto não possui servidor próprio para enviar ou sincronizar dados financeiros.
- No Tauri, parte dos dados fica no SQLite e parte no armazenamento local da WebView.
- No navegador, os dados ficam no `localStorage` do dispositivo.
- Notificações usam apenas a permissão local do sistema operacional.

## Exclusão e segurança

Os dados podem ser removidos apagando os registros dentro do aplicativo ou limpando os dados locais da aplicação. Antes de limpar dados ou desinstalar, o usuário deve considerar que ainda não existe sincronização ou recuperação automática em nuvem.

Não use dados bancários sensíveis, senhas, CVV ou números completos de cartão no campo de descrição das transações.
