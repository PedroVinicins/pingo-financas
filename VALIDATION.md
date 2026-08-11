# Validação do projeto — Pingo v0.4.1

## Validado neste ambiente

- `npm test`: 13 testes aprovados;
- `npm run build`: TypeScript e build de produção aprovados;
- migrations SQLite `0001` até `0005` executadas em sequência em um banco limpo;
- migration `0005_category_kinds.sql` preserva categorias anteriores como despesas;
- banco validado com 8 categorias de despesa e 7 categorias de entrada;
- máscara monetária validada para milhar, vírgula e duas casas decimais;
- store impede uma despesa de usar categoria de entrada;
- plugin oficial de notificações do Tauri configurado no Rust, JavaScript e capabilities mobile/desktop.

## Testes automatizados

- saldo único e separação de gastos por cartão;
- saldo disponível e valores guardados em cofres;
- rejeição de valores zerados;
- categorias incompatíveis com o tipo da transação;
- deep links do Gasto rápido;
- formatação e persistência de valores no padrão brasileiro.

## Validação necessária no Fedora/Android

O ambiente de geração não possui `cargo` nem Android SDK. Antes de distribuir o APK, execute:

```bash
npm install
npm test
npm run build

cd src-tauri
cargo test
cargo check
cd ..

npm run android:shortcuts
npm run android:dev
```

No primeiro uso, abra o sino no topo e toque em **Ativar lembretes** para o Android solicitar a permissão de notificações.
