# Pingo

**Pingo** é um gerenciador de finanças pessoais mobile-first em Rust + Tauri + Vue 3.

> Registre um gasto enquanto ele ainda está fresco na cabeça.

A proposta é unir a velocidade de um app de carteira no celular com ferramentas mais completas de organização no desktop.

## Destaques da versão 0.4

### Pingo Cofres

- organize Porquinho do Inter, Caixinha do Nubank, poupança, investimentos e dinheiro físico;
- registre saldo inicial, depósitos e retiradas;
- defina meta, cor, ícone e rentabilidade anual estimada;
- acompanhe progresso, rendimento projetado e meses de cobertura da reserva;
- veja o saldo livre separado do dinheiro reservado;
- todos os registros funcionam no SQLite do Tauri e no fallback `localStorage` do navegador.

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

Há também um script para instalar atalhos estáticos do Android (`Novo gasto`, `Carteira` e `Cofres`) depois do `tauri android init`.

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

```bash
npm run tauri android init
npm run android:shortcuts
npm run android:dev
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

O SQLite é inicializado no diretório de dados da aplicação. As migrations atuais são:

```text
0001_init.sql
0002_debit_cards.sql
0003_card_personalization.sql
0004_vaults_and_card_backgrounds.sql
```

Valores monetários são persistidos como texto e tratados com `rust_decimal` no core Rust. No frontend, cálculos reativos usam centavos em `bigint`.

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
    └── views/                 # resumo, carteira e cofres
```
