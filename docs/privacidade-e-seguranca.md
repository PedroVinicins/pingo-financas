# Privacidade e segurança

O Pingo é um organizador financeiro local, não é um banco e não possui serviço próprio de sincronização financeira.

## Dados e processamento

- Os lançamentos e os demais dados são guardados no dispositivo: SQLite no runtime Tauri e armazenamento local no navegador.
- Extratos são lidos no dispositivo. O arquivo original não é enviado nem mantido pelo Pingo após a importação.
- A importação de PDF só extrai texto selecionável; não há serviço de OCR.
- O backup JSON é criado localmente. Ele só sai do dispositivo quando o usuário escolhe salvar ou compartilhar.
- Anexos da Carteira digital ficam no armazenamento local e não substituem o documento original.
- Notificações e sensor de movimento dependem das permissões do dispositivo. Amostras do acelerômetro não são armazenadas.
- O PIN não é persistido em texto. Biometria é verificada pela interface nativa do sistema, sem que o Pingo receba os dados biométricos.
- O Pingo não pede número completo, validade ou CVV de cartão.

## Controles

Use **Ocultar valores** para privacidade visual e **Bloqueio do aplicativo** para exigir PIN ao abrir/retomar o Pingo. Esses controles não substituem a senha do dispositivo, criptografia do armazenamento nem práticas seguras de backup. No navegador, qualquer pessoa com acesso ao perfil do dispositivo pode tentar acessar os dados locais.

O reset total remove os registros locais depois de confirmação explícita. Como não há sincronização em nuvem, mantenha uma cópia segura se precisar recuperar dados.

## Reportar vulnerabilidade

Não publique vulnerabilidades como issue aberta. Use o [Security Advisory privado](https://github.com/PedroVinicins/pingo-financas/security/advisories/new) e informe versão, passos para reproduzir e impacto, sem incluir dados financeiros reais. Consulte a [Política de segurança](../SECURITY.md) para o procedimento oficial.

Veja a [Política de privacidade](../PRIVACY.md) para a descrição formal do tratamento e exclusão de dados.
