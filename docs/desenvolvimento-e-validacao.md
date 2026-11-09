# Desenvolvimento e validação

## Scripts npm

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desenvolvimento Vite para Web |
| `npm run build` | Checagem de tipos Vue/TypeScript e build Web de produção |
| `npm run preview` | Servir a build localmente para inspeção |
| `npm test` | Executar Vitest uma vez |
| `npm run test:watch` | Executar Vitest em modo observação |
| `npm run check` | Testes frontend seguidos do build |
| `npm run validate` | `npm run check` e testes Rust com lockfile |
| `npm run tauri:dev` | Executar versão desktop Tauri |
| `npm run android:dev` | Executar versão Android |
| `npm run android:build -- --debug --apk --target aarch64 --ci` | Gerar APK debug ARM64 |

Os hooks `preandroid:dev` e `preandroid:build` executam `npm run android:shortcuts`. Consulte [Começar o projeto](./start-projeto.md) para requisitos das plataformas.

## Comandos Rust

Da raiz do repositório:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Testes

Os testes frontend ficam próximos aos módulos em `src/**/__tests__`. Eles cobrem componentes Vue, store e serviços, incluindo valores monetários, análises, importação, persistência, viewport mobile, notificações, atalhos, backups e automações. O core Rust tem testes unitários nos módulos e testes de integração em `src-tauri/tests`.

Para uma alteração, rode o teste direcionado primeiro e depois os comandos aplicáveis acima. Mudanças que afetam persistência ou regras financeiras devem incluir cobertura para validação, saldo e regressões entre runtime Web e Tauri, quando aplicável.

## Integração contínua

O workflow `.github/workflows/ci.yml` roda em push/PR para `main` e manualmente. Ele instala Node 22 e dependências do frontend, executa `npm test` e `npm run build`; para Rust, instala dependências Tauri do Linux e roda `cargo fmt --check`, `cargo check --locked` e `cargo test --locked`.

## Mudanças de esquema

Adicione uma migration SQL numerada em `src-tauri/migrations/` para evoluir o banco SQLite. Migrations existentes são executadas em ordem em instalações persistentes: não altere uma migration já distribuída para corrigir o estado de bancos existentes. Inclua testes Rust para o comportamento novo e valide a inicialização a partir de banco limpo.

## Publicação

O workflow de release é acionado por tags `v*.*.*` e confere que a versão do `package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml` corresponde à tag. O `versionCode` Android também deve ser incrementado para cada nova versão Android. A geração/publicação do APK pode exigir credenciais e configuração de assinatura fora do repositório.

O fluxo detalhado está em [RELEASE_ANDROID.md](../RELEASE_ANDROID.md), cujo número de versão usado nos exemplos é histórico e deve ser substituído pela versão em preparação. Para padrões de contribuição, veja [CONTRIBUTING.md](../CONTRIBUTING.md).

## Cuidados com dados

Não use dados financeiros reais em fixtures, testes, issues ou commits. Não inclua arquivos SQLite locais, backups, extratos, chaves, tokens ou arquivos `.env` nas alterações. Mudanças no esquema e no formato do backup devem preservar os dados locais e comunicar compatibilidade.
