# Acessos dos sites SBW — 02/11/2026

O objetivo desta etapa é medir audiência própria: páginas visitadas, visitas por sessão, origem dos links, streamers, campanhas, navegadores, dispositivos e abertura em navegador/PWA. A Cloudflare continua independente. A antiga orientação de somente eventos de produto foi ampliada por solicitação expressa do proprietário.

## Painéis

- Championship: `/admin/analytics.html`, além da aba Analytics em `/admin/admin.html`.
- SaberWolf Esports: `/admin/analytics.html`.
- Cada site usa seu projeto Supabase e sua própria conta administrativa. Não há compartilhamento de senhas ou de sessões de autenticação entre as marcas.

## Coleta e atribuição

`js/core/sbw-site-compliance.js` carrega configuração, classificação e coletor. A preferência de métricas deve estar autorizada. DNT/GPC e revogação são respeitados. Na SaberWolf, a escolha anterior sobre a Twitch é preservada ao apresentar a nova categoria de métricas.

Uma visita usa UUID aleatório, renovado após 30 minutos sem atividade. O identificador não representa uma pessoa única. A origem da entrada continua nas páginas seguintes. Links entre os domínios das marcas podem carregar somente as tags de divulgação; nenhum token de login ou identificador de sessão é transferido entre marcas.

O link já publicado da TigerFurious encaminha `utm_source=tigerfurious&utm_medium=colaborador&utm_campaign=comerciais_sbw`; essas tags são reconhecidas. Links diretos também podem usar `?ref=tigerfurious`, `?ref=elitz` e `?ref=dlucca`. Sem tags ou referência fornecida pelo navegador, a fonte aparece como Direto / origem não informada. Navegador é uma dimensão separada da origem.

PWA é identificado pelo modo de exibição; aplicativos com identificação SBW no user agent são apresentados como app. Outros WebViews aparecem como navegador integrado, sem atribuí-los indevidamente ao aplicativo SBW. Nenhum número equivale à audiência simultânea da transmissão de um streamer.

## Banco e permissões

O coletor `sbw-track-access` valida origem, chave pública do projeto, campos permitidos, tamanho e frequência. Ele grava pela RPC `sbw_record_access_event`, executável apenas pelo servidor. A chave administrativa é lida do ambiente da Edge Function e não está no frontend.

As tabelas `sbw_analytics_private.access_sessions` e `access_events` usam RLS sem políticas de acesso direto: visitantes e usuários não consultam nem inserem linhas. A RPC administrativa retorna agregados e exige permissão real no banco. Championship preserva a verificação administrativa existente; SaberWolf verifica o vínculo ativo em `site_permissions`, sem confiar em metadados editáveis do perfil. A consulta histórica da SaberWolf também passa pela verificação estrita.

Registros anteriores são preservados e exibidos separadamente. Não recebem tags de streamers retroativas. Períodos e dias seguem America/Sao_Paulo. Filtros de 7/30/90 dias e intervalo personalizado de até 180 dias. A seleção de streamer filtra as páginas e as fontes do período.

Não são enviados conteúdo de formulários, senhas, tokens, URL completa, query string de navegação ou IP bruto às tabelas. IP de conexão é usado apenas na memória do coletor para limitação de frequência, por hash temporário. Logs da infraestrutura têm tratamento próprio do provedor.

## Validação

- Testes Node de classificação, sessão, consentimento, revogação, payload, permissões da chave pública, limites e deduplicação.
- Testes SQL em transação descartada para administrador, conta comum, visitante, RLS, duplicatas, sessão, filtros e exclusão de tráfego de teste.
- Teste HTTP real em cada coletor com `is_test: true`; a segunda chamada mantém o mesmo evento e confirma deduplicação. Esses registros não entram nos gráficos oficiais.
- Navegador em CI com autenticação simulada, chamadas externas bloqueadas e coletores interceptados. Nenhuma senha real é utilizada nem e-mail enviado.

A infraestrutura mantém o Product Analytics anterior para evolução separada; esta interface apresenta acessos do site.
