# Validação do projeto — Pingo v0.10.0

## Validado neste ambiente

- `npm test`: 48 testes aprovados em 10 arquivos;
- `npm run build`: TypeScript, Vue e build PWA de produção aprovados;
- `npm audit --audit-level=high`: nenhuma vulnerabilidade conhecida;
- `cargo fmt --all -- --check`: aprovado;
- `cargo test --locked`: 29 testes aprovados (26 no core e 3 de integração);
- migrations SQLite `0001` até `0009` executadas em sequência nos bancos limpos dos testes;
- lotes de extrato e transferências de Porquinho validados com rollback/atomicidade;
- PWA gerado com cache `pingo-shell-v0.10.0`, manifest, ícone e service worker;
- APK Android ARM64 debug gerado com pacote `com.pedrosilva.financas.debug`;
- APK confirmado com `versionName` 0.10.0, `versionCode` 10000, `minSdk` 24, `targetSdk` 36 e ABI `arm64-v8a`;
- APK assinado por certificado Android Debug e verificado com APK Signature Scheme v2;
- Manifest Android confirmado com `windowSoftInputMode="adjustResize"`, backup externo desativado e quatro atalhos do launcher;
- APK contém somente a biblioteca nativa `libpingo_financas_lib.so` em `arm64-v8a`;
- SHA-256 do APK: `5178b59b5e6f2fae8f73111caa9c1d53abcaa44a4f5fdc3b18e1dfc5f5edd171`.

## Testes automatizados

- saldo único, saldo disponível e separação de gastos por cartão;
- transferência conta → Porquinho sem alterar o patrimônio e com registro de movimento;
- persistência SQLite de ajustes, cofres, movimentos, reservas, recorrências e hora da transação;
- atomicidade entre entradas e reservas automáticas;
- rejeição de valores zerados, saldo negativo, data/hora incompatível e limite mensal excedido;
- categorias únicas por tipo e incompatibilidade entre categoria e transação;
- deep links e atalhos do Gasto rápido;
- teclado visual e cálculo da área útil de modais mobile;
- formatação e persistência de valores no padrão brasileiro;
- vencimento real das recorrências e prazo automático de três dias;
- criação do Piloto Mensal e envio ao Porquinho dentro do formulário de transações;
- ordem, visibilidade e tamanhos válidos do painel personalizável;
- reset total do SQLite e do armazenamento Web;
- leitura do exemplo CSV/TSV do Banco Inter, OFX e linhas extraídas de PDF textual;
- preservação de data/hora, limpeza de códigos operacionais e detecção de PIX, débito e crédito;
- sugestão de vínculo de cartão, duplicatas, conciliação de saldo e rollback de extratos inválidos;
- validação de anexos locais e visualizador da carteira ao vivo;
- saudação por horário, interpretação dos comandos de voz, sensibilidade e cooldown do gesto de agitar;
- radar diário de gastos e persistência das preferências da Central do Pingo.

## APK gerado

Arquivo:

```text
src-tauri/gen/android/app/build/outputs/apk/universal/debug/Pingo-0.10.0-Android-ARM64.apk
```

Tamanho: 180.356.675 bytes. Esta build é para celulares ARM64 e usa o sufixo `.debug`, portanto pode ser instalada ao lado do pacote de produção.

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

export JAVA_HOME=/caminho/para/o/jdk-17
npm run android:build -- --debug --apk --target aarch64 --ci
```

O Gradle 8.14.3 emite avisos de APIs descontinuadas em código gerado pelo Tauri e seus plugins. Eles não impediram a compilação.

No primeiro uso, abra a Central do Pingo para autorizar notificações, voz ou movimento somente se desejar usar esses recursos.
