# Changelog

## 0.12.0 — Privacidade que acompanha você

- adiciona Bloqueio do App na abertura e após retorno do segundo plano, com tela de privacidade imediata;
- integra Face ID, impressão digital e íris pelo sistema nativo, mantendo PIN numérico de 4 a 6 dígitos como alternativa;
- protege o PIN com Argon2 no SQLite, PBKDF2 no fallback Web e bloqueio temporário após cinco tentativas incorretas;
- amplia a análise financeira com saldo real, déficit, margem baixa, categorias de entradas e saídas, valores médios, concentração e horários dos gastos;
- adiciona moeda padrão BRL, USD ou EUR e aplica símbolo e formatação em saldos, históricos, cartões, porquinhos e notificações;
- mostra o histórico completo de lançamentos do perfil local, sem limitá-lo ao período selecionado;
- corrige a máscara monetária para digitação natural da direita para a esquerda e protege campos e textos de todos os modais em telas estreitas;
- enriquece notificações financeiras com descrição, contexto e valores formatados na moeda escolhida;
- remove completamente os atalhos de voz e recalibra o gesto de agitar para sensores mobile reais;
- adiciona atalhos Android separados para entrada e saída e permite fixar um cartão da Carteira na tela inicial;
- atualiza Web/PWA, Tauri e Android para a versão 0.12.0 (`versionCode` 12000).

## 0.11.0 — Mais simples, mais Pingo

- redesenha a experiência mobile e desktop usando superfícies claras, cartão principal preto e roxo como destaque;
- adiciona tokens semânticos para cores, raios, sombras e tema escuro sem hexadecimais espalhados pelos novos componentes;
- reorganiza a navegação em Contas, Início, Análises e Ajustes com barra flutuante e sidebar responsiva;
- permite trocar entre seções com gesto horizontal e protege controles, formulários, cards arrastáveis e carrosséis;
- destaca saldo disponível e patrimônio no Início e adiciona seletor de mês conectado aos totais reais da Pinia;
- mantém a personalização da Home com ordem, visibilidade, tamanhos e salvamento automático;
- cria ações rápidas para Gasto, Entrada e transferência ao Porquinho usando os fluxos financeiros existentes;
- transforma Ajustes em uma página agrupada com perfil, orçamento, aparência, registro, notificações, dados e segurança;
- implementa tema Claro, Escuro e Sistema persistido, incluindo atualização em tempo real quando o aparelho muda;
- adiciona exportação CSV e restauração validada e atômica do backup JSON, mantendo privacidade, lembretes e resets;
- corrige definitivamente estouros de nomes, categorias, cartões e valores no histórico de compras;
- atualiza Web/PWA e Android para a versão 0.11.0 (`versionCode` 11000).

## 0.10.0 — Pingo na palma da mão

- corrige estouros de nomes e valores longos em cartões e réguas, limitando os textos a uma linha com reticências;
- adapta os formulários ao teclado no iOS e ao `adjustResize` no Android, mantendo campos e botões alcançáveis por rolagem;
- transforma o Resumo em um grid P/M/G que pode ser reordenado por mouse ou toque com animação e salvamento automático;
- remove avisos flutuantes automaticamente após 3, 4 ou 5 segundos com transição de saída configurável;
- reúne gesto de agitar, radar diário, limites, cards da tela inicial, lembretes, economia, backup e reset total na Central do Pingo;
- adiciona saudação por hora local e gesto de agitar com sensibilidade configurável, dois picos de confirmação e proteção contra repetição;
- usa a imagem escolhida pelo usuário como fundo de um cartão ao vivo e abre o original em um visualizador de tela cheia;
- adiciona “Enviar para o Porquinho” ao formulário e preserva o patrimônio por meio de uma transferência atômica entre saldo livre e reserva;
- preserva data e hora de lançamentos manuais e importados no Web e no SQLite;
- melhora o parser CSV/TSV, OFX e PDF: remove códigos operacionais, reconhece PIX, débito, crédito e cartão e sugere o vínculo correto;
- atualiza Web/PWA e Android para a versão 0.10.0 (`versionCode` 10000).

## 0.9.0 — Seu extrato pingou

- importa extratos CSV, TSV, OFX e PDFs com texto selecionável, incluindo o formato exportado pelo Banco Inter;
- mostra uma prévia local, permite escolher categorias e ignora ocorrências que já existem no histórico;
- concilia o saldo da carteira com o saldo mais recente do banco sem acionar reservas automáticas sobre entradas antigas;
- impede que um extrato antigo sobrescreva o saldo quando o Pingo já possui lançamentos mais novos;
- processa lotes de importação de forma atômica no SQLite e desfaz a operação quando ela deixaria o saldo inconsistente;
- inclui as reservas por entrada e por mês já durante a criação do porquinho;
- corrige a duplicação causada pela execução imediata de uma nova reserva mensal;
- adiciona “Pingou errado? Corrigir valor” para ajustar o saldo real do porquinho preservando o patrimônio total;
- deixa patrimônio total e saldo da carteira como os dois indicadores principais do Resumo;
- permite editar valor, data, categoria e detalhes das compras dentro de cada cartão;
- atualiza Web/PWA e Android para a versão 0.9.0 (`versionCode` 9000).

## 0.8.0 — O Pingo do seu jeito

- permite reorganizar os cartões diretamente na tela principal por arrastar e soltar, inclusive por toque;
- permite mostrar, esconder e mudar o tamanho de cada indicador com salvamento automático;
- adiciona reset total com confirmação digitada para apagar dados, preferências e arquivos locais;
- reúne cartões de débito e cartões ao vivo na mesma carteira e no mesmo fluxo de novo cartão;
- cria cartões ao vivo offline para ingressos, documentos, imagens, PDFs e QR Codes;
- limita anexos a 3 MB e mantém todo o conteúdo sensível somente no dispositivo;
- adiciona reserva mensal por porquinho com valor fixo ou porcentagem do saldo disponível;
- processa a reserva uma única vez por mês, no dia escolhido, sem permitir saldo negativo;
- persiste painel, carteira ao vivo e automações mensais no SQLite e no fallback Web;
- inclui os novos dados no backup JSON e atualiza orientações de privacidade;
- atualiza Web/PWA e Android para a versão 0.8.0 (`versionCode` 8000).

## 0.7.0 — Confiança em cada pingo

- migra configurações da conta, recorrências, reservas automáticas e movimentos de cofres para o SQLite no Tauri;
- importa automaticamente os dados auxiliares mantidos pela WebView nas versões anteriores;
- grava renda e reservas automáticas na mesma transação do banco;
- limita o conjunto de reservas automáticas ao valor da entrada que as disparou;
- grava movimentações e atualização do saldo do cofre de forma atômica;
- protege saldo disponível e limite mensal do cartão também no core Rust;
- permite categorias com o mesmo nome quando pertencem a tipos diferentes;
- transforma a versão Web em um PWA instalável, responsivo e disponível offline;
- adiciona backup local em JSON, busca e filtros no histórico e exclusão segura de transações;
- substitui alertas nativos do navegador por feedbacks e confirmações integrados ao layout;
- adiciona estados de carregamento, recuperação de falhas, conectividade e atualização da Web;
- melhora acessibilidade, foco por teclado, alvos de toque, safe areas e privacidade dos valores;
- define CSP para builds Tauri e configura a release Android com `versionCode` 7000;
- permite instalar a build Android de desenvolvimento ao lado da versão de produção;
- amplia os atalhos Android para Novo gasto, Carteira, Cofres e Resumo;
- adiciona testes de integração do SQLite, recorrências e reservas automáticas.

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
