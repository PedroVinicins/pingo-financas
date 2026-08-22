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
- Na **Central do Pingo**, o usuário pode ativar **Agitar para novo gasto** e escolher a sensibilidade. O gesto funciona enquanto o app está aberto no Resumo, exige dois movimentos rápidos e possui intervalo de segurança contra abertura repetida.

## Deep links

O esquema do aplicativo é `pingo://`.

```text
pingo://income
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

- **Nova entrada** → `pingo://income`
- **Nova saída** → `pingo://expense`
- **Carteira** → `pingo://wallet`
- **Cofres** → `pingo://vaults`

Depois, execute:

```bash
npm run android:dev
```

Em launchers Android compatíveis, pressione e segure o ícone do Pingo para acessar as ações.

## Atalho de um cartão específico

Na tela Carteira, abra um cartão e toque em **Tela inicial**. O Android pedirá confirmação para fixar um ícone próprio desse cartão. Ao tocar nele, o Pingo abre a Carteira com o cartão já selecionado:

```text
pingo://wallet?card=84d...
```

Em launchers sem suporte a atalhos fixados, o Pingo copia esse endereço como alternativa.

## iPhone / iOS

O esquema `pingo://` também fica registrado na build iOS. No app Atalhos do iOS, uma automação pode usar **Abrir URLs** com `pingo://expense` e ser adicionada à Tela de Início.

## Segurança

Os atalhos não carregam valor, CVV, validade ou número completo do cartão. Um atalho específico carrega apenas o ID interno do cartão usado pelo Pingo.
