# Validação do projeto — Pingo v0.8.0

## Validado neste ambiente

- `npm test`: 30 testes aprovados;
- `npm run build`: TypeScript e build de produção aprovados;
- `npm audit`: nenhuma vulnerabilidade conhecida nas dependências npm;
- `cargo fmt --all -- --check` e `cargo check --locked`: aprovados;
- `cargo test --locked`: 25 testes aprovados (22 no core e 3 de integração);
- migrations SQLite `0001` até `0008` executadas em sequência em um banco limpo;
- `PRAGMA foreign_key_check` não encontrou inconsistências;
- banco validado com 8 categorias de despesa e 7 categorias de entrada;
- as tabelas de painel, carteira ao vivo e reserva mensal foram criadas corretamente;
- PWA incluído na build Web com manifest, ícone e service worker;
- layouts conferidos em viewport mobile (390 × 844) e desktop (1440 × 1000);
- APK Android ARM64 debug gerado com pacote `com.pedrosilva.financas.debug`, `versionName` 0.8.0, `versionCode` 8000 e `minSdk` 24;
- APK limpo contém somente a biblioteca nativa `libpingo_financas_lib.so`.

## Testes automatizados

- saldo único, saldo disponível e separação de gastos por cartão;
- persistência SQLite de ajustes, cofres, movimentos, reservas e recorrências;
- atomicidade entre entradas e reservas automáticas;
- rejeição de valores zerados, saldo negativo e limite mensal excedido;
- categorias únicas por tipo e incompatibilidade entre categoria e transação;
- deep links do Gasto rápido;
- formatação e persistência de valores no padrão brasileiro;
- vencimento real das recorrências e prazo automático de três dias;
- criação do Piloto Mensal dentro do formulário de transações;
- ordem, visibilidade e tamanhos válidos do painel personalizável;
- reserva mensal executada no dia correto e apenas uma vez por competência;
- validação de anexos locais e persistência da carteira ao vivo;
- transferência inicial da conta principal para um porquinho;
- busca no histórico por descrição, categoria e cartão.

## Integração contínua

O workflow `.github/workflows/ci.yml` executa automaticamente em pushes e Pull Requests:

- `npm ci`, testes e build do frontend;
- `cargo check --locked` e `cargo test --locked` no core Tauri;
- instalação das dependências Linux recomendadas pelo Tauri 2.

## Como repetir a validação

```bash
npm ci
npm run validate
npm audit --audit-level=high

npm run android:shortcuts
export JAVA_HOME=/caminho/para/o/jdk-17
npm run android:build -- --debug --apk --target aarch64 --ci
```

O Gradle ainda emite avisos de APIs descontinuadas em código gerado pelo Tauri e seus plugins; eles não impediram a compilação.

No primeiro uso, abra o sino no topo e toque em **Ativar lembretes** para o Android solicitar a permissão de notificações.
