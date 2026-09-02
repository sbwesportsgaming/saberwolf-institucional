# v1.6.84.1 — Central de links da -SBW-

## Objetivo

Criar uma central de links própria, responsiva e integrada ao site para substituir serviços externos de bio link e permitir expansão futura para creators e atletas.

## Páginas públicas

- `/links/` — links institucionais do ecossistema -SBW-.
- `/links/dlucca/` — links oficiais do D’Lucca.

## Implementação

- Layout mobile-first com identidade visual azul, ciano e metálica já usada pela plataforma.
- Configuração compartilhada em `js/links/links-config.js` para facilitar atualização e criação de novos perfis.
- Renderização compartilhada em `js/links/links-page.js`.
- Botões identificados com `data-sbw-track`, aproveitando o Analytics agregado já existente.
- Metadados de compartilhamento, canonical, acessibilidade de teclado e suporte a redução de movimento.
- Nenhum link fictício ou destino de demonstração foi publicado.

## Analytics

- Page views entram na categoria `links`.
- Cada botão possui um nome de evento próprio, permitindo comparar cliques por perfil e destino.
- O rastreamento mantém as regras de privacidade já adotadas pela plataforma.
