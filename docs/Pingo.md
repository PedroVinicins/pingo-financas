# Documentação do Pingo

O Pingo é um gerenciador local de finanças pessoais, mobile-first, construído com Vue 3, TypeScript, Pinia, Tauri 2, Rust e SQLite. Ele organiza lançamentos, cartões, carteira digital, porquinhos, recorrências e análises sem conectar a contas bancárias.

Esta documentação descreve o comportamento da versão registrada no projeto. Para políticas formais, consulte também [Privacidade](../PRIVACY.md), [Segurança](../SECURITY.md) e [Validação](../VALIDATION.md).

## Guias

- [Começar o projeto](./start-projeto.md) — requisitos, instalação e execução Web, desktop e Android.
- [Funcionalidades](./funcionalidades.md) — telas, lançamentos, indicadores, carteira e automações.
- [Funcionalidades mobile](./funcionalidades-mobile.md) — navegação responsiva, PWA, atalhos, teclado, sensores e bloqueio.
- [Arquitetura](./arquitetura.md) — camadas do frontend, comunicação Tauri e organização do código.
- [Dados e persistência](./dados-e-persistencia.md) — modelo financeiro, SQLite, armazenamento Web e migrations.
- [Importação e backup](./importacao-e-backup.md) — extratos aceitos, prévia, exportação, restauração e reset.
- [Desenvolvimento e validação](./desenvolvimento-e-validacao.md) — comandos, testes, CI e fluxo de release.
- [Privacidade e segurança](./privacidade-e-seguranca.md) — limites de segurança e tratamento de dados no dispositivo.

## Visão geral

O aplicativo oferece quatro áreas principais:

1. **Contas**: cartões de débito na Carteira e dinheiro separado em Porquinhos.
2. **Início**: saldo disponível, patrimônio, ações rápidas, histórico e painel personalizável.
3. **Análises**: entradas, saídas, categorias, períodos, metas e alertas calculados a partir dos lançamentos.
4. **Ajustes**: perfil, aparência, moeda, notificações, preferências, backup, segurança e reset.

Na versão Web, a persistência financeira usa `localStorage` e o PWA pode manter o shell do app disponível offline após a instalação/carregamento inicial. No aplicativo Tauri, os registros financeiros ficam no SQLite local; preferências de experiência continuam no armazenamento local da WebView. Nenhum dos modos sincroniza dados com um servidor do projeto.

## Limites importantes

- O Pingo é um organizador; não é banco, não acessa contas bancárias e não movimenta dinheiro real.
- Cartões são identificadores para organizar despesas, não contas independentes.
- Arquivos de extrato são lidos no dispositivo; a importação não cria uma conexão bancária.
- Backup, importações e reset são ações locais do dispositivo. Sem backup externo, não há recuperação em nuvem.
