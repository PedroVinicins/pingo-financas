# Changelog

## 0.6.0 — Radar do Pingo

- integra o Piloto Mensal ao fluxo principal de Adicionar transação;
- separa lançamentos únicos de contas e rendas recorrentes sem alterar o saldo antes da confirmação;
- cria a aba Gastos com despesas do mês, economia, meta de 20%, categorias e contas no radar;
- reúne economias do mês e valores dos porquinhos em uma leitura mais visual;
- amplia as mensagens bem-humoradas do Pingo conforme gastos, saldo e desempenho financeiro;
- melhora a navegação mobile para acessar Resumo, Gastos, Gasto rápido, Carteira e Cofres;
- adiciona CI para validar frontend e Rust em cada Pull Request;
- adiciona Dependabot, templates e documentos de segurança, privacidade e contribuição;
- remove arquivos temporários do TypeScript do versionamento.

## 0.5.1 — Vencimentos no dia certo

- corrige as recorrências para liberar a confirmação de conta e salário somente no vencimento ou depois dele;
- começa a contar os três dias do lançamento automático somente após a data escolhida pelo usuário;
- guarda o próximo vencimento real, inclusive quando a recorrência é criada depois do dia selecionado;
- adiciona uma escolha explícita para transferir dinheiro da conta ao criar um porquinho ou começar com ele vazio;

## 0.5.0 — Pingo no controle

- transforma depósitos e retiradas dos cofres em transferências entre conta principal e porquinho;
- adiciona histórico de transferências manuais e reservas automáticas;
- permite personalizar nome, instituição, meta, rendimento, cor e emoji de cada porquinho;
- adiciona reserva automática por valor fixo ou percentual sempre que uma entrada é confirmada;
- mostra patrimônio total, saldo na conta e total guardado no resumo;
- adiciona opção de esconder todos os valores e editar o saldo real sem apagar o histórico;
- permite corrigir valor, data, categoria, descrição e meio de pagamento de compras antigas;
- impede qualquer nova despesa, edição ou lançamento automático de deixar a conta negativa;
- adiciona salário, renda, conta, assinatura e recarga mensal com lembrete no dia escolhido;
- mantém contas recorrentes pendentes até o botão “Essa dívida eu já paguei”;
- após três dias sem resposta, registra a despesa automaticamente somente quando há saldo;
- mantém salários pendentes até a confirmação “Opa, já pingou!”;
- adiciona gastos por categoria, média diária, projeção, maior categoria e compromissos fixos;
- adiciona mensagens bem-humoradas do Pingo após entradas, gastos e transferências.

## 0.4.1 — Categorias, valores e lembretes

- separa categorias de entrada e despesa em todos os lançamentos;
- adiciona categorias de entrada como Salário, Freelance, Trabalho extra, Vendas e Rendimentos;
- permite criar categorias personalizadas no lançamento completo e no Gasto rápido;
- migra categorias existentes com segurança para o tipo `expense`;
- impede salvar uma transação com categoria incompatível;
- formata valores automaticamente no padrão brasileiro, com ponto de milhar e vírgula decimal;
- amplia e destaca o botão Gasto rápido na área de alcance do polegar;
- adiciona alertas configuráveis diários, a cada três dias ou semanais;
- agenda notificações nativas no Android e mostra lembretes enquanto a versão Web estiver aberta;
- atualiza o app para a versão 0.4.1.

## 0.4.0 — Cofres e inteligência financeira

- adiciona a aba Cofres com metas, movimentações e rendimento estimado;
- separa saldo disponível do dinheiro reservado;
- adiciona taxa de economia, gastos fixos, orçamento diário e projeção mensal;
- adiciona indicador de saúde financeira e cobertura da reserva;
- adiciona fundos visuais locais aos cartões;
- melhora a navegação inferior e os fluxos mobile;
- adiciona migration SQLite para cofres e personalização de cartões;
- amplia os testes de cálculos financeiros e estado reativo.

## 0.3.0 — Pingo Wallet

- adiciona cartões de débito com saldo compartilhado;
- adiciona gasto rápido e atalhos por deep link;
- adiciona personalização, congelamento e histórico por cartão.
