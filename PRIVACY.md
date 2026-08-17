# Política de privacidade

O Pingo é um aplicativo local de organização financeira e não é um banco.

## Dados tratados

O aplicativo pode armazenar informações inseridas pelo próprio usuário, como transações, categorias, apelidos de cartões, porquinhos, metas, recorrências, ingressos, documentos, imagens, PDFs e conteúdos de QR Code.

- O Pingo não solicita número completo do cartão, validade ou CVV.
- O Pingo não acessa contas bancárias nem movimenta dinheiro real.
- O projeto não possui servidor próprio para enviar ou sincronizar dados financeiros.
- No Tauri, os dados financeiros ficam no SQLite local; preferências de experiência ficam no armazenamento local privado da WebView.
- No navegador, os dados ficam no `localStorage` do dispositivo.
- Notificações usam apenas a permissão local do sistema operacional.
- O atalho por movimento usa o acelerômetro somente enquanto o Resumo está aberto; as amostras não são gravadas nem enviadas.
- O atalho de voz aciona o reconhecimento do sistema/navegador somente depois de um toque explícito. O Pingo não mantém o microfone ouvindo em segundo plano.
- O backup em JSON é gerado no próprio dispositivo e só sai dele quando o usuário escolhe salvar ou compartilhar o arquivo.
- Anexos da carteira ao vivo ficam no armazenamento local do Pingo e não são enviados para validação ou nuvem. Eles não substituem o documento original.
- Extratos CSV, OFX e PDF são lidos localmente. O arquivo original não é enviado nem guardado pelo Pingo; somente os lançamentos que o usuário confirmar entram no histórico.
- PDFs precisam conter texto selecionável. O Pingo não envia documentos escaneados para serviços externos de OCR.

## Exclusão e segurança

Os dados podem ser removidos individualmente ou pelo **Reset total** das configurações. Esse reset exige que o usuário digite `APAGAR` e remove permanentemente transações, saldos, categorias personalizadas, cartões, anexos, porquinhos, automações, alertas e preferências do dispositivo. No fim, o Pingo recria apenas as categorias originais necessárias para um novo começo.

Antes de usar o reset, limpar os dados locais ou desinstalar, exporte um backup se quiser conservar o histórico: não existe sincronização ou recuperação automática em nuvem.

Proteja o dispositivo com senha ou biometria caso guarde documentos pessoais. Não use dados bancários sensíveis, senhas, CVV ou números completos de cartão no campo de descrição das transações.
