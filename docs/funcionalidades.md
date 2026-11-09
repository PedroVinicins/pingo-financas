# Funcionalidades

## Navegação

A aplicação tem quatro áreas principais: **Contas**, **Início**, **Análises** e **Ajustes**. No mobile, a navegação usa uma barra inferior; em telas maiores, usa a navegação lateral. A seção Contas alterna entre **Carteira** e **Porquinhos**.

## Lançamentos financeiros

Um lançamento registra:

- tipo: entrada ou saída;
- valor positivo;
- data e, opcionalmente, hora;
- categoria do mesmo tipo do lançamento;
- descrição;
- recorrência fixa ou variável;
- cartão opcional para uma saída.

O formulário pode ser aberto pelas ações rápidas, pelo Início ou pelas Análises. O Gasto rápido oferece uma entrada simplificada para registrar uma saída. Lançamentos podem ser editados ou excluídos; a exclusão recalcula os saldos e é recusada se deixar o saldo disponível negativo.

O core valida categoria, valor, descrição e relação entre tipo e cartão. Uma entrada não pode ser associada a um cartão de débito. Despesas respeitam o saldo disponível, o congelamento do cartão e seu limite mensal, quando configurado.

## Início e indicadores

O Início reúne saldo disponível, patrimônio, saldo nos porquinhos, resumo do mês, ações rápidas e histórico. O período pode ser alterado para consultar os lançamentos e resultados de outros meses; os dados financeiros continuam vindo da mesma store.

Os blocos do painel podem ser reorganizados, redimensionados ou ocultados. Os blocos disponíveis incluem patrimônio, saldo disponível, porquinhos, gastos do mês, orçamento diário, resultado mensal, compromissos recorrentes, leituras do Pingo e histórico. O layout pode ser restaurado nas configurações.

O saldo pode ser ocultado visualmente. Também é possível ajustar o saldo disponível inicial; isso altera o ajuste de abertura da conta, não cria um lançamento de entrada.

## Análises

A área Análises apresenta gastos, economias, categorias, distribuição por horário e alertas gerados localmente a partir do histórico. Entre os indicadores existentes estão média de gastos, projeção mensal, despesas fixas, taxa de economia, orçamento diário e cobertura da reserva.

A missão de guardar 20% é um indicador comparativo, não uma transferência automática. Os resultados dependem dos lançamentos e do período selecionado. O Pingo não consulta bancos nem valida se os dados representam o saldo bancário real.

## Carteira e cartões de débito

Os cartões servem para categorizar compras dentro do saldo geral, não mantêm saldo próprio. Cada cartão pode registrar apelido, emissor, titular, bandeira, últimos quatro dígitos, limite mensal, estado congelado, cartão principal, cores, padrões, emoji e imagem de fundo local. A Carteira mostra compras, totais e média do cartão selecionado.

O Pingo não solicita nem armazena número completo do cartão, validade ou CVV. Congelar um cartão impede novas compras associadas a ele no Pingo; não bloqueia o cartão no banco.

## Porquinhos

Porquinhos separam parte do saldo disponível para metas, poupança, investimentos ou dinheiro em espécie. É possível:

- criar e personalizar nome, instituição, tipo, objetivo, cor e emoji;
- depositar e retirar valores, com histórico de movimentos;
- corrigir o saldo informado preservando o patrimônio total;
- configurar reserva automática por entrada e reserva mensal em valor fixo ou percentual;
- acompanhar progresso da meta, estimativa de rendimento e cobertura da reserva.

Taxa de rendimento e projeção são informativas; não representam rendimento contratado nem integração com uma instituição financeira. As transferências entre saldo disponível e porquinhos não são entradas/saídas do patrimônio.

## Recorrências

O **Piloto Mensal** cadastra compromissos previstos por tipo, valor, dia do mês, categoria e, para despesas, cartão opcional. Uma recorrência pode ter lembrete, pode ser pausada e cada vencimento precisa ser liquidado/confirmado. O app pode processar vencimentos automaticamente após o prazo configurado (três dias por padrão); a recorrência não é uma cobrança nem uma ordem enviada ao banco.

## Categorias

Categorias são separadas entre entradas e saídas, com nome, ícone e cor. O formulário só permite categorias compatíveis com o tipo de lançamento. O conjunto inicial é criado para iniciar a conta e categorias personalizadas podem ser adicionadas.

## Ajustes

Em Ajustes, o usuário pode configurar nome de perfil, limite mensal, tema claro/escuro/sistema, moeda (BRL, USD ou EUR), notificações, saudação, radar diário, modo de economia, sensibilidade do gesto de agitar, duração dos avisos e visibilidade dos blocos do Início. A moeda altera a formatação dos valores, não converte saldos nem consulta cotações. Também há ferramentas para importação, backup, exportação CSV, bloqueio local e reset total.

Os detalhes de importação e backup estão em [Importação e backup](./importacao-e-backup.md); as opções específicas de toque e acesso rápido estão em [Funcionalidades mobile](./funcionalidades-mobile.md).
