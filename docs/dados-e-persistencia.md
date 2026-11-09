# Dados e persistência

## Modelo financeiro

Os principais registros são:

- **Transação:** entrada ou saída, valor, data/hora, categoria, descrição, recorrência e cartão opcional.
- **Categoria:** tipo (entrada/saída), nome, ícone e cor.
- **Cartão de débito:** identificação não sensível, aparência, estado e limite de gastos mensal.
- **Porquinho:** saldo reservado, meta, tipo, personalização e estimativa de rendimento.
- **Movimento de porquinho:** depósito/retirada manual ou automática.
- **Regra de reserva:** valor fixo ou percentual, por entrada e/ou mensal.
- **Regra recorrente:** compromisso previsto, data de vencimento, lembrete e estado de processamento.
- **Item de carteira digital:** ingresso, documento, QR Code ou item livre, com conteúdo/anexo local opcional.
- **Preferências de painel e conta:** layout, ajuste do saldo inicial e visibilidade do saldo.

## Cálculo de saldos

Em centavos:

```text
patrimônio total = ajuste de saldo inicial + entradas - saídas
saldo bruto disponível = patrimônio total - total nos porquinhos
saldo disponível exibido = máximo(saldo bruto disponível, zero)
```

Cartões não têm saldo próprio e suas compras continuam compondo as saídas gerais. Transferir dinheiro para dentro ou para fora de um porquinho altera a parcela disponível/reservada e registra um movimento, sem criar entrada ou saída que altere o patrimônio total. Corrigir saldo do porquinho também preserva o patrimônio.

Um valor inicial ou saldo conciliado pode ser representado pelo ajuste de abertura da conta, sem fabricar lançamentos no histórico. O Pingo valida operações para impedir saldo disponível negativo.

## Onde os dados ficam

### Tauri (desktop e mobile)

O banco `finances.sqlite3` fica no diretório de dados da aplicação fornecido pelo Tauri. O SQLite aplica foreign keys e migrations versionadas. Transações, categorias, cartões, porquinhos, movimentos, regras, itens da carteira digital, configurações de conta, layout e configuração do Bloqueio do App são persistidos no banco.

Preferências de experiência, como tema, moeda, perfil, notificações e opções do Pingo, usam armazenamento local da WebView. Algumas configurações de notificação também ficam em armazenamento local. O backup exportável reúne as preferências definidas no formato de backup, mas não inclui o verificador do bloqueio nem o PIN.

### Web/PWA

O modo Web usa `localStorage` para dados do aplicativo. O cache do service worker contém o shell e assets, não é sincronização nem substitui o backup. Os dados pertencem ao perfil/origem do navegador; limpar armazenamento do site ou trocar de navegador pode torná-los indisponíveis.

## Migrations SQLite

As migrations são aplicadas em ordem pelo SQLx. Não edite uma migration que já foi distribuída para usuários; crie uma nova migration para mudanças futuras.

| Arquivo | Responsabilidade principal |
|---|---|
| `0001_init.sql` | Categorias iniciais e transações |
| `0002_debit_cards.sql` | Cartões e vínculo de cartão nas despesas |
| `0003_card_personalization.sql` | Estilo e emoji do cartão |
| `0004_vaults_and_card_backgrounds.sql` | Porquinhos e fundos de cartão |
| `0005_category_kinds.sql` | Tipo de categoria |
| `0006_category_scope.sql` | Separação de categorias por tipo |
| `0007_persisted_app_state.sql` | Ajustes, movimentos, reservas e recorrências |
| `0008_personal_dashboard_wallet.sql` | Painel, carteira digital e reservas mensais |
| `0009_transaction_time.sql` | Hora de ocorrência da transação |
| `0010_app_lock.sql` | Configuração local do Bloqueio do App |

Os arquivos estão em [`src-tauri/migrations`](../src-tauri/migrations/).

## Migração do armazenamento antigo

Ao abrir no Tauri uma instalação que ainda contém dados auxiliares de versões antigas na WebView, o repositório importa os registros compatíveis para o SQLite uma vez e grava um marcador de migração. As versões Web e Tauri mantêm armazenamentos locais distintos; não há sincronização entre elas.

## Precisão e validação

O frontend normaliza cálculos em centavos (`bigint`); o core usa `rust_decimal`. Valores monetários são persistidos como strings decimais. O core também valida referências a categorias/cartões, valores positivos, compatibilidade de tipos, limites de cartão e disponibilidade de saldo. Não modifique diretamente o SQLite para contornar essas regras.

Consulte [Importação e backup](./importacao-e-backup.md) para copiar, restaurar ou apagar os dados.
