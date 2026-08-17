# Como contribuir

Obrigado por ajudar a melhorar o Pingo.

## Preparação

```bash
git clone https://github.com/PedroVinicins/pingo-financas.git
cd pingo-financas
npm ci
npm run dev
```

Para trabalhar no Tauri, instale também as dependências do sistema descritas no README.

## Fluxo recomendado

1. Crie uma branch a partir da `main` atualizada.
2. Faça uma alteração pequena e bem definida.
3. Adicione ou atualize os testes necessários.
4. Execute as verificações locais.
5. Abra uma Pull Request explicando o problema, a solução e como validar.

```bash
git switch main
git pull --ff-only
git switch -c feat/nome-da-melhoria

npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Não inclua saldos reais, bancos de dados locais, tokens, arquivos `.env` ou outras informações pessoais nos commits.
