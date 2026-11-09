# Começar o projeto

Este guia cobre o desenvolvimento da aplicação Web/PWA, desktop Tauri e Android. Os comandos partem da raiz do repositório.

## Requisitos

- Node.js 22 (versão usada na integração contínua) e npm.
- Rust stable e Cargo para compilar/testar o core Tauri.
- Para desktop, dependências nativas do Tauri 2 e WebKitGTK conforme o sistema operacional. Consulte os [pré-requisitos oficiais do Tauri](https://v2.tauri.app/start/prerequisites/) para sua plataforma.
- Para Android, Android Studio/SDK, ferramentas de linha de comando do Android, Gradle disponibilizado pelo projeto e JDK 17. O build atual pode não ser compatível com versões mais novas do Java.

## Instalar dependências e executar Web

```bash
npm ci
npm run dev
```

O Vite exibe a URL local (normalmente `http://localhost:5173`). Para testar a compilação de produção:

```bash
npm run build
npm run preview
```

Em execução fora do Tauri, o repositório frontend usa `localStorage`. A versão Web de produção registra o service worker do PWA, que armazena o shell e os assets versionados para reabertura offline. A instalação como PWA depende do suporte do navegador e de servir a aplicação por HTTPS ou `localhost`.

## Executar desktop com Tauri

Instale primeiro os pré-requisitos do Tauri 2 para seu sistema operacional. O README contém um exemplo de dependências Fedora.

```bash
npm ci
npm run tauri:dev
```

O comando inicia o servidor de desenvolvimento definido em `scripts/tauri-dev-server.mjs` e abre a janela Tauri. O aplicativo desktop usa o SQLite local para os dados financeiros.

## Executar Android

Configure `JAVA_HOME` para um JDK 17 e instale/configure o Android SDK. Inicialize o projeto Android uma vez:

```bash
npm run tauri android init
npm run android:shortcuts
```

O script de atalhos modifica arquivos gerados em `src-tauri/gen/android`; rode-o novamente após reinicializar a plataforma Android. Os scripts `android:dev` e `android:build` também têm hooks que tentam preparar os atalhos antes de iniciar/compilar.

Para executar no dispositivo ou emulador:

```bash
npm run android:dev
```

Para um APK de desenvolvimento ARM64:

```bash
npm run android:build -- --debug --apk --target aarch64 --ci
```

## Outros comandos de uso frequente

```bash
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run validate
```

`npm run validate` roda os testes frontend, o build/checagem TypeScript e os testes Rust. Mais opções estão em [Desenvolvimento e validação](./desenvolvimento-e-validacao.md).

## Diagnóstico rápido

- Se `npm ci` falhar, confira a versão do Node e use a versão de npm incluída com ela.
- Se a compilação Tauri falhar antes do Rust, valide as bibliotecas nativas e o WebKit requeridos pelo sistema.
- Se o Android não encontrar SDK/Java, verifique `JAVA_HOME`, `ANDROID_HOME` ou `ANDROID_SDK_ROOT`.
- Se os atalhos Android não forem instalados, confirme que `npm run tauri android init` terminou antes de `npm run android:shortcuts`.
- Para conferir as variáveis e arquivos de versão Android em uma publicação, consulte [RELEASE_ANDROID.md](../RELEASE_ANDROID.md); os números de versão de exemplo nesse guia devem ser adaptados à release atual.
