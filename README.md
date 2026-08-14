# Pingo

[![CI](https://github.com/PedroVinicins/pingo-financas/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroVinicins/pingo-financas/actions/workflows/ci.yml)

**Pingo** é um gerenciador de finanças pessoais mobile-first em Rust + Tauri + Vue 3.

> Registre um gasto enquanto ele ainda está fresco na cabeça.

A proposta é unir a velocidade de um app de carteira no celular com ferramentas mais completas de organização no desktop.

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
pingo://expense
pingo://expense?card=<id>
pingo://wallet
pingo://dashboard
pingo://vaults
```

Há também um script para instalar quatro atalhos estáticos do Android (`Novo gasto`, `Carteira`, `Cofres` e `Resumo`) depois do `tauri android init`.

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
- atalho próprio para registrar despesas.

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
