# Como criar uma branch e publicar uma release Android

Este guia usa a versão `0.14.6` como exemplo. Troque esse número pela versão que será publicada.

## Posso fazer apenas um commit na branch?

Sim. Uma branch de release pode ter somente um commit.

Para este projeto, o fluxo mais simples é preparar todas as alterações, conferir os arquivos e criar um único commit chamado `chore(release): v0.14.6`.

O ideal em projetos maiores é que as funcionalidades já estejam na `main` e a branch de release contenha apenas a troca de versão. Em uma entrega pequena, também é possível colocar as correções e a troca de versão no mesmo commit, desde que tudo seja revisado antes.

## 1. Conferir o estado do projeto

Antes de criar a branch, veja se existem alterações ainda não salvas no Git:

```bash
git status --short --branch
```

Se o projeto estiver limpo, atualize a `main`:

```bash
git switch main
git pull --ff-only origin main
```

Se houver alterações que já fazem parte da nova versão, não use comandos que apaguem esses arquivos. Crie a branch diretamente e mantenha as alterações nela.

## 2. Criar a branch da versão 0.14.6

```bash
git switch -c release/0.14.6
```

Confirme a branch atual:

```bash
git branch --show-current
```

O resultado esperado é:

```text
release/0.14.6
```

## 3. Atualizar o número da versão

Atualize `package.json` e `package-lock.json`:

```bash
npm version 0.14.6 --no-git-tag-version
```

Depois, altere manualmente:

- `src-tauri/Cargo.toml`: `version = "0.14.6"`;
- `src-tauri/tauri.conf.json`: `"version": "0.14.6"`;
- `src-tauri/tauri.conf.json`: `"versionCode": 14006`.

Atualize o `Cargo.lock` após mudar o `Cargo.toml`:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

O `versionCode` do Android deve sempre aumentar. Neste projeto usamos:

```text
0.14.4 → 14004
0.14.5 → 14005
0.14.6 → 14006
```

Confira se todos os arquivos mostram a mesma versão:

```bash
rg -n '0\.14\.6|versionCode' package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
```

## 4. Testar antes do único commit

```bash
npm ci
npm run validate
```

Confira as alterações que entrarão na versão:

```bash
git status --short
git diff --check
git diff
```

Só continue quando os testes passarem e a lista de arquivos estiver correta.

## 5. Fazer um único commit

Se todas as alterações mostradas por `git status` pertencem à versão `0.14.6`:

```bash
git add -A
git commit -m "chore(release): v0.14.6"
```

Confirme que a branch possui o commit esperado:

```bash
git log --oneline main..HEAD
git status --short --branch
```

Envie a branch ao GitHub:

```bash
git push -u origin release/0.14.6
```

## 6. Colocar a branch na main

A forma recomendada é abrir um Pull Request no GitHub:

```text
release/0.14.6 → main
```

Revise os testes do Pull Request e faça o merge. Se quiser manter apenas um commit na `main`, use **Squash and merge**.

Se o repositório permitir merge direto e ninguém tiver alterado a `main` depois da criação da branch:

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only release/0.14.6
git push origin main
```

## 7. Criar a tag e a Release do GitHub

Faça isso somente depois que a versão estiver na `main`:

```bash
git switch main
git pull --ff-only origin main
git tag -a v0.14.6 -m "Pingo v0.14.6"
git push origin v0.14.6
```

O workflow `.github/workflows/release.yml` valida as versões e cria automaticamente a Release `v0.14.6` no GitHub.

Confira a publicação:

```bash
gh release view v0.14.6
```

## 8. Gerar o APK

Configure o JDK 17 e o Android SDK conforme a instalação da sua máquina. Exemplo:

```bash
export JAVA_HOME="/usr/lib/jvm/java-17-temurin-jdk"
export ANDROID_HOME="/home/SEU_USUARIO/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

Gere o APK ARM64 de teste:

```bash
npm run android:build -- --debug --apk --target aarch64 --ci
```

O arquivo será criado em:

```text
src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Esse APK usa assinatura de debug. Para distribuição pública definitiva, gere um APK de produção assinado com uma chave Android protegida.

## 9. Colocar o APK na Release

Crie uma cópia com um nome fácil de identificar:

```bash
cp src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk /tmp/pingo-v0.14.6-android-arm64-debug.apk
```

Envie o APK:

```bash
gh release upload v0.14.6 /tmp/pingo-v0.14.6-android-arm64-debug.apk --clobber
```

Confira a Release e os arquivos publicados:

```bash
gh release view v0.14.6 --json url,assets
```

## Resumo rápido

```bash
git switch -c release/0.14.6
# atualizar as versões e revisar as alterações
npm run validate
git add -A
git commit -m "chore(release): v0.14.6"
git push -u origin release/0.14.6
# fazer o merge da branch na main
git switch main
git pull --ff-only origin main
git tag -a v0.14.6 -m "Pingo v0.14.6"
git push origin v0.14.6
```

Não crie a tag antes dos testes e do merge. A tag é o que dispara a publicação automática da Release.
