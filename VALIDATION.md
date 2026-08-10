# Validação do projeto — Pingo v0.3

## Validado neste ambiente

- migrations SQLite `0001_init.sql`, `0002_debit_cards.sql` e `0003_card_personalization.sql` executadas em banco limpo;
- colunas `pattern` e `emoji` adicionadas a `debit_cards`;
- `ON DELETE SET NULL` continua preservando transações ao remover cartão;
- serviços TypeScript de persistência e deep links passaram por `tsc --strict` com shims dos módulos Tauri;
- script `setup-android-shortcuts.mjs` foi executado contra uma estrutura Android simulada e adicionou corretamente:
  - metadata `android.app.shortcuts`;
  - `res/xml/shortcuts.xml`;
  - strings de `Novo gasto` e `Carteira`;
- componentes Vue foram verificados estruturalmente com parser HTML para detectar markup básico quebrado;
- `node --check` validou o script de atalhos Android.

## Testes adicionados

- `src/services/__tests__/quickLaunch.spec.ts`
  - `pingo://expense`;
  - cartão pré-selecionado por query string;
  - fallback web via `?quick=expense`.
- testes existentes da store continuam cobrindo saldo único e separação de gastos por cartão.
- testes Rust do modelo de cartão agora cobrem textura/sticker e limites de dados do cartão.

## Limitações do ambiente de geração

Não foi possível executar `cargo test` porque este ambiente não possui `cargo/rustc`.

Também não foi possível executar `npm install`, `npm run build` ou Vitest porque o registry NPM disponível neste ambiente retorna 404 para pacotes oficiais do Tauri, incluindo `@tauri-apps/api`. Isso é uma limitação do registry interno do ambiente, não do projeto.

Na sua máquina execute:

```bash
npm install
npm run build
npm test

cd src-tauri
cargo test
cargo check
```

Para Android:

```bash
npm run tauri android init
npm run android:shortcuts
npm run android:dev
```
