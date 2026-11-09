# Arquitetura

## Stack

- **Interface:** Vue 3 com `<script setup>` e TypeScript.
- **Estado:** Pinia.
- **Estilos:** Tailwind CSS e DaisyUI.
- **Build Web:** Vite.
- **Desktop/mobile nativo:** Tauri 2.
- **Core e persistência nativa:** Rust, SQLx, SQLite e `rust_decimal`.
- **Testes:** Vitest/Vue Test Utils no frontend e testes Rust/Cargo no core.

## Estrutura do repositório

```text
src/
  App.vue                 Coordena navegação, inicialização, bloqueio e fluxos globais
  components/             Formulários, cartões, modais e componentes reutilizáveis
  data/                   Categorias iniciais
  services/               Persistência, importação, análises, PWA, mobile e utilitários
  stores/                 Estado e operações financeiras da aplicação
  types/                  Tipos compartilhados do domínio frontend
  views/                  Telas Contas, Início e Análises
src-tauri/
  capabilities/           Permissões/capacidades Tauri
  migrations/             Evolução do esquema SQLite
  src/
    commands/             Comandos invocáveis pelo frontend
    db/                   Inicialização SQLite e repositório
    models/               Tipos e validações de domínio Rust
    services/             Serviços do core, inclusive bloqueio local
scripts/                  Automação de desenvolvimento e atalhos Android
public/                   Manifest, service worker, ícones e fundos locais
```

## Inicialização e navegação

`src/main.ts` cria a aplicação Vue, registra Pinia e instala a sincronização da viewport mobile. `src/App.vue` inicializa a store, aplica tema, gerencia navegação entre as telas, ações de deep link, bloqueio, gesto de agitar, notificações e modais globais.

As telas são componentes carregados pelo fluxo de navegação do App; o projeto não usa um roteador Vue dedicado. `AccountsView.vue` alterna entre `WalletView.vue` e `VaultsView.vue`.

## Fluxo de dados

```text
View / componente
      ↓
financeStore (estado, validação de fluxo e cálculos reativos)
      ↓
financeRepository (seleciona Tauri ou localStorage)
      ↓
Comandos Tauri → services Rust → FinanceRepository → SQLite
```

O frontend usa tipos em `src/types/finance.ts`. Em runtime Tauri, `financeRepository.ts` invoca comandos registrados em `src-tauri/src/lib.rs`; o core Rust aplica validações e operações que dependem do banco. Fora do Tauri, o mesmo serviço oferece implementação local por `localStorage`, utilizada pela versão Web e pelos testes do frontend.

Os cálculos monetários da store frontend usam centavos como `bigint`. No core, os valores são representados por `rust_decimal` e persistidos como texto decimal no SQLite, evitando operações monetárias com ponto flutuante binário.

## Core Tauri

`src-tauri/src/lib.rs` configura os plugins de deep link, notificações, diálogo e filesystem; em mobile, configura biometria; no Android, registra o plugin de atalhos. Na inicialização, abre o banco no diretório de dados da aplicação, ativa chaves estrangeiras e executa as migrations SQLx.

O módulo de comandos expõe operações para transações, categorias, cartões, porquinhos, movimentos e reservas, painel, carteira digital, recorrências, backup/reset e bloqueio. `FinanceRepository` concentra as operações SQLite. As regras monetárias e validações de domínio estão em modelos/serviços Rust, não devem ser substituídas por validação apenas visual no frontend.

## PWA e assets

O módulo `src/services/pwa.ts` registra o service worker somente para a build Web de produção; a execução Tauri não registra esse worker. `public/sw.js` cacheia o shell e assets do build e oferece atualização do cache. Fundos dos cartões e ícones em `public/` são assets locais.

## Configurações

- `vite.config.ts`, `tsconfig*.json` e `vitest.config.ts`: build, TypeScript e testes frontend.
- `tailwind.config.js` e `postcss.config.js`: estilos.
- `src-tauri/tauri.conf.json`: build, janela, CSP, deep links e versão Android.
- `src-tauri/capabilities/`: capacidades concedidas ao frontend Tauri.
- `.github/workflows/ci.yml`: integração contínua.

Para executar os fluxos, veja [Começar o projeto](./start-projeto.md). Para entender o armazenamento e o esquema, veja [Dados e persistência](./dados-e-persistencia.md).
