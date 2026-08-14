# Pingo — acesso rápido no celular

O Pingo foi desenhado para registrar uma compra em poucos toques.

## Dentro do app

- O botão central **Gasto** fica sempre disponível na navegação mobile.
- A tela **Gasto rápido** abre com o campo de valor em foco.
- Os valores R$ 5, R$ 10, R$ 20 e R$ 50 podem ser escolhidos com um toque.
- As categorias usadas recentemente aparecem primeiro.
- O cartão principal é pré-selecionado automaticamente.
- Na Pingo Wallet, **Gasto neste cartão** abre a mesma tela com o cartão escolhido.
- A descrição é opcional: se ficar vazia, a categoria vira a descrição básica.

## Deep links

O esquema do aplicativo é `pingo://`.

```text
pingo://expense
pingo://expense?card=<UUID_DO_CARTAO>
pingo://wallet
pingo://wallet?card=<UUID_DO_CARTAO>
pingo://dashboard
pingo://vaults
```

Isso permite abrir diretamente uma ação do Pingo a partir de atalhos do sistema, automações e launchers compatíveis.

## Android — atalhos ao segurar o ícone

Depois de inicializar o projeto Android:

```bash
npm run tauri android init
npm run android:shortcuts
```

O script adiciona quatro atalhos estáticos ao launcher:

- **Novo gasto** → `pingo://expense`
- **Carteira** → `pingo://wallet`
- **Cofres** → `pingo://vaults`
- **Resumo** → `pingo://dashboard`

Depois, execute:

```bash
npm run android:dev
```

Em launchers Android compatíveis, pressione e segure o ícone do Pingo para acessar as ações.

## Atalho de um cartão específico

Na tela Carteira, abra um cartão e toque em **Atalho**. O Pingo copia uma URL como:

```text
pingo://expense?card=84d...
```

Ela pode ser usada em um launcher/automação para abrir o registro de gasto com aquele cartão já selecionado.

## iPhone / iOS

O esquema `pingo://` também fica registrado na build iOS. No app Atalhos do iOS, uma automação pode usar **Abrir URLs** com `pingo://expense` e ser adicionada à Tela de Início.

## Segurança

Os atalhos não carregam valor, CVV, validade ou número completo do cartão. Um atalho específico carrega apenas o ID interno do cartão usado pelo Pingo.
