# Validação do projeto — Pingo v0.12.0

## Validado neste ambiente

- `npm test`: 62 testes aprovados em 14 arquivos;
- `npm run build`: TypeScript, Vue e build PWA de produção aprovados;
- `npm audit --audit-level=high`: nenhuma vulnerabilidade conhecida;
- `cargo fmt --all -- --check`: aprovado;
- `cargo test --locked`: 32 testes aprovados (29 no core e 3 de integração);
- migrations SQLite `0001` até `0010` executadas em sequência nos bancos limpos dos testes;
- lotes de extrato e transferências de Porquinho validados com rollback/atomicidade;
- PWA gerado com cache `pingo-shell-v0.12.0`, manifest, ícone e service worker;
- APK Android ARM64 debug gerado com pacote `com.pedrosilva.financas.debug`;
- APK confirmado com `versionName` 0.12.0, `versionCode` 12000, `minSdk` 24, `targetSdk` 36 e ABI `arm64-v8a`;
- APK assinado por certificado Android Debug e verificado com APK Signature Scheme v2;
- Manifest Android confirmado com permissão biométrica, `windowSoftInputMode="adjustResize"`, backup externo desativado e quatro atalhos do launcher;
- APK contém somente a biblioteca nativa `libpingo_financas_lib.so` em `arm64-v8a`;
- SHA-256 do APK: `32d8bc0ba6f9b4d503788096a9ec1754bafc0fad0e56c5a31516ac10f0c1602a`.

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
- máscara monetária da direita para a esquerda e exibição em BRL, USD e EUR;
- vencimento real das recorrências e prazo automático de três dias;
- criação do Piloto Mensal e envio ao Porquinho dentro do formulário de transações;
- ordem, visibilidade e tamanhos válidos do painel personalizável;
- reset total do SQLite e do armazenamento Web;
- restauração de backup validada no Web e aplicada de forma atômica no SQLite;
- leitura do exemplo CSV/TSV do Banco Inter, OFX e linhas extraídas de PDF textual;
- preservação de data/hora, limpeza de códigos operacionais e detecção de PIX, débito e crédito;
- sugestão de vínculo de cartão, duplicatas, conciliação de saldo e rollback de extratos inválidos;
- validação de anexos locais e visualizador da carteira ao vivo;
- saudação por horário, sensibilidade e cooldown do gesto de agitar;
- radar diário de gastos e persistência das preferências da Central do Pingo;
- hash Argon2 do PIN, limites de tamanho e verificação do Bloqueio do App;
- período selecionado como fonte única dos indicadores, com histórico completo independente do mês;
- ações rápidas abertas no tipo e fluxo corretos para gasto, entrada e Porquinho.

## APK gerado

Arquivo:

```text
src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Tamanho: 184.056.130 bytes. Esta build é para celulares ARM64 e usa o sufixo `.debug`, portanto pode ser instalada ao lado do pacote de produção.

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

export JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk
npm run android:build -- --debug --apk --target aarch64 --ci
```

O Gradle 8.14.3 emite avisos de APIs descontinuadas em código gerado pelo Tauri e seus plugins. Eles não impediram a compilação.

No primeiro uso, abra a Central do Pingo para autorizar notificações, biometria ou movimento somente se desejar usar esses recursos.
