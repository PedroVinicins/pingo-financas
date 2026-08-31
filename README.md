# Pingo

[![CI](https://github.com/PedroVinicins/pingo-financas/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroVinicins/pingo-financas/actions/workflows/ci.yml)

**Pingo** é um gerenciador de finanças pessoais mobile-first em Rust + Tauri + Vue 3.

> Registre um gasto enquanto ele ainda está fresco na cabeça.

A proposta é unir a velocidade de um app de carteira no celular com ferramentas mais completas de organização no desktop.

## Destaques da versão 0.15.1

- campos de todos os modais permanecem dentro da tela em celulares estreitos;
- inputs nativos de data e hora agora encolhem corretamente no Android;
- o foco e o teclado virtual não deslocam mais os formulários na horizontal;
- Android `versionCode` 15001 e cache Web renovado para a correção.

## Destaques da versão 0.15.0

- todos os modais usam uma base DaisyUI consistente e totalmente responsiva;
- rolagem interna, safe areas e ações fixas continuam acessíveis com o teclado móvel aberto;
- abrir, fechar, salvar e cancelar têm foco previsível e alvos adequados para telas sensíveis ao toque;
- novas categorias oferecem 12 ícones para gastos e 9 para entradas;
- Android `versionCode` 15000 e cache Web renovado para a nova release.

## Destaques da versão 0.14.3

- escolha explícita entre os extratos do Banco Inter e Nubank;
- leitura das movimentações Nubank de Pix, débito, fatura e Caixinhas;
- todos os modais mobile acompanham a área visível do teclado no APK Android;
- Android `versionCode` 14003 e cache Web renovado para a nova release.

## Destaques da versão 0.14.2

- modais mobile com área segura, rolagem sem sobreposição e campos que não acionam zoom indevido;
- saldo principal responsivo, mantendo o último dígito visível mesmo em valores longos;
- importação local de CSV, TSV, TXT tabular, OFX, QFX e PDF textual também no seletor de arquivos Android;
- CSV mais flexível para metadados antes do cabeçalho, débito/crédito separados, datas curtas e formatos monetários diferentes;
- OFX/QFX antigo sem tags de fechamento e valores com precisão adicional convertidos corretamente para centavos;
- descrição bancária limpa, sem `PAYMENT`, códigos técnicos ou nomes repetidos;
- modo seguro recomendado que prioriza PIX e só vincula cartão quando o extrato declara cartão, débito ou crédito;
- Android `versionCode` 14002 e cache Web renovado para a nova release.

## Destaques da versão 0.13.1

- importador de extratos mais inteligente para PDFs do Banco Inter, com datas por bloco e conciliação pelo saldo diário;
- classificação automática de Pix, salário, débito, crédito, estorno, tarifas, aplicações e resgates;
- categorias sugeridas por movimentação e transferências de Porquinho fora dos totais de receitas e despesas;
- cadastro e vínculo de cartão durante a própria importação;
- mensagens de erro e estados de salvamento mais claros na Carteira;
- novo ícone do Pingo alinhado à identidade violeta;
- Android `versionCode` 13001 e cache Web renovado para a nova release.

## Destaques da versão 0.13.0

- Início redesenhado com saldo, ações rápidas, histórico e resumo mensal na mesma linguagem visual;
- modais responsivos acima da navegação, com rolagem e área segura para manter as ações sempre alcançáveis;
- categorias sem limitação por posição e com ícones próprios para casa, alimentação, transporte, saúde, lazer e renda;
- Carteira e cartões alinhados ao tema violeta, com novos estados, botões, superfícies e sombras;
- arraste de blocos e gesto lateral com acompanhamento visual do dedo;
- textos, valores e horários protegidos contra overflow em toda a interface;
- confirmações ao adicionar categorias e concluir transferências;
- Android `versionCode` 13000 e cache Web renovado para a nova release.

## Destaques da versão 0.12.0

- Bloqueio do App com PIN local, Face ID, impressão digital ou íris e proteção ao retornar do segundo plano;
- análise financeira mais completa, cruzando saldo, entradas, saídas, categorias, horários, média e maior impacto do período;
- moeda padrão configurável entre BRL, USD e EUR, aplicada a toda a interface e às notificações;
- histórico completo do perfil local e notificações enriquecidas com valores formatados;
- máscara monetária da direita para a esquerda e modais protegidos contra overflow em celulares;
- gesto de agitar recalibrado, comandos de voz removidos e atalhos Android para entrada, saída e cartões;
- Android `versionCode` 12000 e cache Web renovado para a nova release.

## Destaques da versão 0.11.0

- nova identidade minimalista e responsiva com tokens semânticos, cartão preto de saldo e roxo como destaque;
- navegação unificada em Contas, Início, Análises e Ajustes, com barra flutuante no mobile e sidebar no desktop;
- gesto horizontal para avançar ou voltar entre seções, sem conflitar com formulários e carrosséis;
- Início reorganizado com saudação, seletor de período, saldo disponível, patrimônio, ações rápidas e últimas transações;
- seletor de mês ligado à Pinia para manter saldo do período, entradas, saídas, histórico e Análises na mesma fonte;
- Ajustes em grupos com perfil, limite mensal, tema Claro/Escuro/Sistema, notificações, privacidade e central do Pingo;
- exportação real das transações em CSV, backup JSON com restauração confirmada e reset total;
- histórico dos cartões protegido contra textos e valores extensos em telas a partir de 320 px;
- Android `versionCode` 11000 e cache Web renovado para a nova release.

## Destaques da versão 0.10.0

- Resumo personalizável em grid P/M/G com arraste fluido por mouse e toque e salvamento automático;
- layout mobile protegido contra textos longos e formulários que se ajustam ao teclado nativo;
- Central do Pingo com gesto de agitar, radar diário, limites, widgets, economia, lembretes, App Lock, backup e reset total;
- saudação por horário local e abertura do Gasto rápido ao agitar o aparelho enquanto o Resumo está aberto;
- cartões ao vivo com foto própria, contraste automático e visualizador da imagem original em tela cheia;
- transferência direta e atômica do saldo disponível para um Porquinho sem alterar o patrimônio;
- parser bancário com data/hora, limpeza de códigos, detecção de PIX/débito/crédito/cartão e sugestão de vínculo;
- Android `versionCode` 10000 e cache Web renovado para a nova release.

## Destaques da versão 0.9.0

- importação local de extratos CSV/TSV, OFX e PDF textual, com suporte ao formato do Banco Inter;
- prévia dos lançamentos, categorias para entradas e saídas, proteção contra duplicatas e conciliação do saldo;
- porquinhos criados já com reserva automática por entrada ou por mês, sem duplicar o valor inicial;
- correção direta do saldo do porquinho preservando o patrimônio;
- patrimônio e saldo da carteira em destaque no Resumo;
- valor, data, categoria e descrição das compras editáveis também dentro dos cartões;
- Android `versionCode` 9000 e cache Web renovado para a nova release.

## Destaques da versão 0.8.0

- painel principal personalizável direto na tela: arraste, redimensione ou esconda indicadores com salvamento automático;
- cartões de débito, ingressos, documentos, imagens, PDFs e QR Codes reunidos na mesma carteira;
- reserva mensal por porquinho com dia, valor fixo ou porcentagem do saldo disponível;
- reset total nas configurações, com confirmação digitada, para apagar todos os dados e restaurar o estado inicial;
- Android `versionCode` 8000 e cache Web renovado para a nova release.

## Destaques da versão 0.7.0

- todos os dados financeiros e preferências ficam juntos no SQLite quando o app roda no Tauri;
- migração automática preserva recorrências, ajustes de saldo e históricos das versões anteriores;
- regras de saldo, cofres, reservas automáticas e limites de cartões são validadas no core Rust;
- versão Web instalável e com funcionamento offline após o primeiro acesso;
- busca e filtros no histórico, exclusão segura e backup local em JSON;
- carregamento, falhas, confirmações e avisos integrados à interface;
- melhorias de acessibilidade, privacidade e navegação em celulares, tablets e desktop;
- Android `versionCode` 7000, atalhos ampliados e build debug instalável em paralelo.

## Destaques da versão 0.6.0

- Piloto Mensal integrado ao formulário de transações;
- nova aba Gastos & economias com meta mensal e análise por categoria;
- visão exclusiva das despesas recentes e compromissos recorrentes;
- leitura conjunta do que foi economizado e do saldo nos porquinhos;
- novas reações e comentários divertidos do Pingo;
- navegação mobile ampliada sem perder o atalho central de Gasto rápido.

## Correções da versão 0.5.1

- confirmação de conta e salário disponível somente no vencimento ou depois dele;
- prazo automático de três dias contado a partir da data escolhida;
- próximo vencimento preservado corretamente entre os meses;
- transferência da conta principal disponível já na criação de um porquinho.

## Destaques da versão 0.5.0

- patrimônio consolidado com conta principal + porquinhos;
- botão para esconder valores e editor seguro do saldo real;
- histórico de compras editável;
- saldo protegido contra valores negativos;
- transferências conta ↔ porquinho com histórico;
- personalização completa e reserva automática por cofre;
- salário, rendas, assinaturas, recargas e contas mensais;
- lembretes mensais com confirmação antes de alterar o saldo;
- lançamento automático de contas atrasadas após três dias, somente se houver saldo;
- estatísticas de compromissos fixos, média diária e destino das despesas;
- mensagens divertidas do Pingo durante o uso.

## Correções da versão 0.4.1

- categorias de entrada e despesa agora são separadas;
- novas entradas oferecem Salário, Freelance, Trabalho extra, Vendas, Benefícios, Rendimentos e Outras entradas;
- novas categorias podem ser criadas sem sair do lançamento;
- campos monetários aplicam automaticamente o padrão brasileiro (`1.234,56`);
- o Gasto rápido ganhou um botão maior na navegação inferior;
- alertas financeiros podem ser configurados pelo sino no topo;
- no Android, os lembretes são agendados pelo sistema; na Web, são exibidos enquanto o navegador estiver aberto.

## Destaques da versão 0.4

### Pingo Cofres

- organize Porquinho do Inter, Caixinha do Nubank, poupança, investimentos e dinheiro físico;
- registre saldo inicial, depósitos e retiradas;
- defina meta, cor, ícone e rentabilidade anual estimada;
- acompanhe progresso, rendimento projetado e meses de cobertura da reserva;
- veja o saldo livre separado do dinheiro reservado;
- transações, categorias, cartões e cofres funcionam no SQLite do Tauri e possuem fallback Web.

O Pingo apenas acompanha os valores informados: ele não acessa nem movimenta contas bancárias.

### Novos cálculos financeiros

- taxa de economia mensal;
- comprometimento da renda com despesas fixas;
- média de despesas dos últimos três meses;
- projeção de gastos até o fim do mês;
- orçamento diário baseado no saldo livre e nos dias restantes;
- cobertura da reserva de emergência;
- indicador de saúde financeira de 0 a 100.

### Cartões com fotos

Além das paletas, texturas e stickers, cada cartão pode usar um dos fundos visuais locais:

- Amazônia;
- praia;
- cidade;
- montanhas.

As imagens ficam dentro do app e continuam disponíveis sem internet.

### Gasto rápido

- botão central fixo no mobile;
- campo de valor recebe foco assim que a tela abre;
- valores rápidos de R$ 5, R$ 10, R$ 20 e R$ 50;
- categorias recentes primeiro;
- cartão principal selecionado automaticamente;
- descrição opcional;
- lançamento direto de dentro de um cartão.

### Acesso rápido fora do app

O Pingo registra o esquema de deep link `pingo://` com o plugin oficial de deep linking do Tauri.

```text
pingo://income
pingo://expense
pingo://expense?card=<id>
pingo://wallet
pingo://wallet?card=<id>
pingo://dashboard
pingo://vaults
```

Há também um script para instalar quatro atalhos estáticos do Android (`Nova entrada`, `Nova saída`, `Carteira` e `Cofres`) depois do `tauri android init`.

Veja [MOBILE_QUICK_ACCESS.md](./MOBILE_QUICK_ACCESS.md).

### Pingo Wallet

Os cartões de débito funcionam como identificadores de pagamento, não como contas separadas. Toda compra continua abatendo do mesmo saldo geral.

Cada cartão pode ter:

- apelido;
- banco/emissor;
- bandeira;
- quatro últimos dígitos;
- cartão principal;
- congelamento;
- limite mensal pessoal;
- paleta de cores;
- textura (`soft`, `waves`, `dots`, `grid`, `aurora`);
- imagem de fundo;
- sticker/emoji;
- histórico separado;
- gasto mensal;
- gasto histórico;
- média por compra;
- atalho próprio na tela inicial para abrir a Carteira diretamente no cartão.

Por segurança, o Pingo não armazena número completo, validade ou CVV.

## Stack

- Rust
- Tauri 2
- Vue 3 + `<script setup>`
- TypeScript
- Pinia
- Tailwind CSS
- SQLite + SQLx
- `rust_decimal`
- Vitest

## Rodar no navegador

```bash
npm install
npm run dev
```

Quando não está dentro do runtime do Tauri, o frontend usa `localStorage` como fallback para facilitar testes de interface.

A build Web é um PWA: pode ser instalada pelo navegador e, após o primeiro carregamento, o shell do aplicativo continua disponível sem internet. Os dados permanecem somente no navegador/dispositivo.

## Rodar no desktop

Instale primeiro as dependências do Tauri para sua distribuição Linux.

No Fedora:

```bash
sudo dnf install -y \
  glib2-devel \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl wget file \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  libxdo-devel \
  pkgconf-pkg-config
```

Depois:

```bash
unset PKG_CONFIG_PATH
npm install
npm run tauri:dev
```

## Android

Use o JDK 17 no build Android. Versões mais novas do Java podem não ser compatíveis com a versão do Gradle usada pelo projeto.

```bash
export JAVA_HOME=/caminho/para/o/jdk-17
npm run tauri android init
npm run android:shortcuts
npm run android:dev
```

Para gerar um APK de desenvolvimento ARM64 instalável ao lado da versão de produção:

```bash
npm run android:build -- --debug --apk --target aarch64 --ci
```

## Testes

Frontend:

```bash
npm test
```

Rust:

```bash
cd src-tauri
cargo test
```

## Persistência

No Tauri, transações, categorias, cartões, cofres, movimentos, ajustes de saldo, reservas automáticas, carteira ao vivo, painel e recorrências são persistidos no SQLite. Ao abrir a versão 0.7.0 pela primeira vez, dados auxiliares das versões anteriores são importados automaticamente da WebView. No navegador, todos os dados continuam no `localStorage`.

O SQLite é inicializado no diretório de dados da aplicação. As migrations atuais são:

```text
0001_init.sql
0002_debit_cards.sql
0003_card_personalization.sql
0004_vaults_and_card_backgrounds.sql
0005_category_kinds.sql
0006_category_scope.sql
0007_persisted_app_state.sql
0008_personal_dashboard_wallet.sql
0009_transaction_time.sql
```

Valores monetários são persistidos como texto e tratados com `rust_decimal` no core Rust. No frontend, cálculos reativos usam centavos em `bigint`.

O menu de configurações permite exportar uma cópia local em JSON. Como esse arquivo contém dados financeiros, ele deve ser guardado em local seguro. O mesmo menu oferece um reset total que apaga permanentemente os dados locais depois que o usuário digita `APAGAR`.

## Segurança, privacidade e contribuição

- [Política de privacidade](./PRIVACY.md)
- [Política de segurança](./SECURITY.md)
- [Como contribuir](./CONTRIBUTING.md)

O projeto ainda não possui uma licença de código aberto definida. Até uma licença ser escolhida, o código continua protegido pelos direitos autorais do autor.

## Arquitetura

```text
pingo/
├── src-tauri/
│   ├── migrations/
│   └── src/
│       ├── commands/
│       ├── db/
│       ├── models/
│       └── services/
├── scripts/
│   └── setup-android-shortcuts.mjs
└── src/
    ├── components/
    ├── data/
    ├── services/
    ├── stores/
    ├── types/
    └── views/                 # resumo, gastos, carteira e cofres
```
