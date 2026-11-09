# Importação e backup

## Importar extrato

A importação é local: o arquivo é selecionado e analisado no dispositivo, e somente os lançamentos confirmados são gravados. O app não envia o extrato a um serviço externo nem cria conexão com o banco.

### Bancos e formatos

| Banco selecionado | Formatos descritos pelo importador | Observação |
|---|---|---|
| Banco Inter | CSV, TSV, TXT tabular, OFX, QFX e PDF textual | PDFs precisam conter texto selecionável; não há OCR remoto. |
| Nubank | CSV do extrato da conta | Integração em beta; revise cada linha antes de confirmar. |

O limite de arquivo do parser é 12 MB e a importação aceita até 2.000 lançamentos por arquivo. Extratos tabulares podem ter cabeçalhos em português ou inglês e separadores variados; os valores reconhecem diferentes convenções de moeda e sinal. OFX/QFX e PDFs são tratados por parsers locais.

### Fluxo de conferência

1. Em Início ou Ajustes, abra **Importar extrato**.
2. Escolha primeiro o banco do arquivo.
3. Selecione o extrato e aguarde a prévia.
4. Confira datas, descrições, valores, tipo e categoria sugerida.
5. Revise as duplicatas detectadas e selecione os lançamentos que deseja incluir.
6. Para saídas, escolha uma categoria de despesas; para entradas, uma categoria de receitas.
7. Decida se o saldo atual deve ser preservado ou conciliado pelo saldo final disponível no extrato.
8. Confirme a importação.

O parser sugere categorias para tipos reconhecidos, como salário, compras e tarifas. Pix e transferências usam categoria padrão escolhida na prévia. A vinculação de cartão é conservadora: o importador só sugere cartão quando a descrição indica explicitamente compra no cartão/débito/crédito. Lançamentos classificados como aplicação ou resgate de Porquinho aparecem como movimentações internas e ficam desmarcados por padrão para não confundir transferências com renda ou despesa.

Arquivos históricos ou com lançamentos mais recentes já presentes podem iniciar com preservação do saldo atual. A conciliação altera o ajuste de abertura para refletir o saldo informado, não cria uma transação artificial.

### Limites da importação

- Formatos específicos de bancos podem mudar; sempre compare a prévia com o documento original.
- O parser não garante a classificação correta de descrições ambíguas.
- O PDF precisa conter texto; imagens digitalizadas não são submetidas a OCR.
- A proteção contra duplicatas é baseada nos dados disponíveis e não substitui a revisão humana.

## Exportar transações CSV

Em Ajustes, **Exportar CSV** salva/compartilha as transações com as colunas data, hora, tipo, descrição, categoria, cartão e valor. O arquivo usa UTF-8 com BOM e separador `;` para facilitar abertura em planilhas configuradas para pt-BR. Ele não é um backup completo e não deve ser usado para restauração.

## Backup JSON

**Backup local** exporta um JSON versionado com transações, categorias, cartões, porquinhos, movimentos, reservas, itens da carteira digital, layout, recorrências, ajustes da conta e preferências. Em navegadores compatíveis, o arquivo pode ser compartilhado; em Tauri, o usuário escolhe onde salvar.

O backup contém informações financeiras e pode conter dados ou anexos da carteira. Proteja o arquivo ao armazená-lo ou compartilhá-lo. Ele não contém o PIN nem a configuração de desbloqueio.

### Restaurar

1. Em Ajustes, selecione **Restaurar backup**.
2. O Pingo valida o formato, os limites, valores e referências.
3. Revise a confirmação: a restauração substitui os dados atuais pelos dados do arquivo.
4. Confirme para aplicar.

Arquivos acima de 100 MB, formato/versão não suportados, identificadores duplicados, referências inconsistentes e valores que deixariam saldo negativo são rejeitados. No Tauri, a restauração é aplicada pelo core com proteção transacional.

## Reset total

O **Reset total** apaga dados, preferências e automações locais; é uma operação permanente. O diálogo exige digitar `APAGAR`. Exporte e confira um backup antes de prosseguir se desejar conservar o histórico. Desinstalar ou limpar os dados do navegador também pode apagar registros sem possibilidade de recuperação pelo Pingo.
