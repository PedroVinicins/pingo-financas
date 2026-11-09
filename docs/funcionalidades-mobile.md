# Funcionalidades mobile

O Pingo é mobile-first, mas também pode ser usado no desktop. Os comportamentos descritos aqui dependem dos recursos e permissões disponibilizados pelo navegador ou sistema operacional.

## Layout e navegação

- A navegação principal usa barra inferior no celular e sidebar em telas maiores.
- Há gesto horizontal entre Contas, Início, Análises e Ajustes; controles interativos e campos de formulário são excluídos do gesto para não interromper seu uso.
- Modais e folhas de ação respeitam safe areas, rolagem interna e teclado virtual. O app mede a área visível com `visualViewport` para ajustar a posição e a altura dos formulários, especialmente na WebView Android.
- O movimento reduzido do sistema é respeitado nas animações de navegação e rolagem.

## Gasto rápido

O botão central da navegação mobile abre o fluxo simplificado de saída. O valor recebe foco, há sugestões de valores rápidos, categorias recentes e seleção do cartão principal quando apropriado. Também pode ser aberto a partir de um cartão específico.

## Instalação PWA e uso offline

A versão Web inclui manifest, ícones e service worker. Um navegador compatível pode oferecer instalação na tela inicial. Após o carregamento inicial, o service worker mantém o shell HTML, os assets de build e imagens locais em cache para permitir reabrir o aplicativo offline.

O cache offline não sincroniza nem replica dados entre dispositivos. No PWA, os dados ficam no armazenamento local do navegador; limpar os dados do site pode removê-los. Exporte um backup para conservar os registros.

O manifest declara atalhos para registrar gasto, abrir carteira, ver porquinhos e abrir o resumo. A disponibilidade e o modo de exibição dependem do navegador/launcher.

## Deep links e atalhos Android

O esquema Tauri `pingo://` suporta estas ações:

| URI | Ação |
|---|---|
| `pingo://expense` | Abrir fluxo de nova saída |
| `pingo://expense?card=<id>` | Gasto rápido vinculado ao cartão |
| `pingo://income` | Abrir fluxo de nova entrada |
| `pingo://wallet` | Abrir a Carteira |
| `pingo://wallet?card=<id>` | Abrir Carteira com cartão selecionado |
| `pingo://vaults` | Abrir Porquinhos |
| `pingo://dashboard` | Abrir Início |

O Android adiciona atalhos estáticos para nova entrada, nova saída, Carteira e Cofres. O comando de cartão permite pedir ao launcher a criação de um atalho individual, sujeito à confirmação e ao suporte do Android. O script `npm run android:shortcuts` prepara os arquivos gerados depois de `tauri android init`.

Para detalhes de configuração e troubleshooting dos atalhos, consulte [MOBILE_QUICK_ACCESS.md](../MOBILE_QUICK_ACCESS.md).

## Gesto de agitar

O usuário pode ativar **Agitar para novo gasto** em Ajustes. O sensor é escutado somente quando o Início está aberto e o fluxo de gasto/modal ou o bloqueio não estão ativos. A sensibilidade pode ser baixa, média ou alta. O sistema pode solicitar permissão de movimento; amostras do acelerômetro não são salvas nem enviadas.

## Bloqueio do aplicativo

O bloqueio local pode exigir PIN ao abrir e ao retornar do segundo plano. Após 30 segundos em segundo plano, o app volta a bloquear. No Tauri móvel, o PIN pode ser combinado com biometria do sistema; na Web, o bloqueio usa somente PIN.

O PIN deve ter de 4 a 6 dígitos. O verificador é armazenado localmente, não o PIN em texto. No Web, é derivado com PBKDF2; no Tauri, o core Rust usa hash Argon2. Tentativas incorretas são limitadas temporariamente. Biometria não é disponibilizada ao Pingo: a autenticação é feita pela interface nativa.

## Notificações

Notificações locais podem lembrar o usuário de registrar gastos, avisar sobre compromissos e exibir atualizações da análise. É necessário conceder a permissão do sistema/navegador. Frequência, suporte em segundo plano e apresentação variam por plataforma e pelas restrições do sistema operacional.

## Limites da experiência mobile

Atalhos, instalação PWA, notificações, sensores e biometria não têm suporte uniforme em todos os dispositivos. Se uma capacidade não estiver disponível, use a navegação dentro do app ou desative a opção correspondente em Ajustes.
