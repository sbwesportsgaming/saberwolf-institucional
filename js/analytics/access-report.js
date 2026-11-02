/* SBW — relatório agregado de acessos, sem registros individuais no navegador. */
(function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
  const fmt=value=>number(value).toLocaleString('pt-BR');
  const names={direct:'Direto / origem não informada',internal:'Origem anterior não identificada',tigerfurious:'TigerFurious',elitz:'EliTz',dlucca:'D’Lucca',google:'Google',bing:'Bing',duckduckgo:'DuckDuckGo',instagram:'Instagram',facebook:'Facebook',youtube:'YouTube',tiktok:'TikTok',twitch:'Twitch',discord:'Discord',x:'X / Twitter',threads:'Threads',mobile:'Celular',tablet:'Tablet',desktop:'Computador',browser:'Navegador',pwa:'App / PWA instalado',app:'Aplicativo identificado',embedded:'Navegador integrado em outro app'};
  const kinds={direct:'Direto',internal:'Não identificada',search:'Buscador',social:'Rede social',streamer:'Link de streamer',campaign:'Campanha identificada',referral:'Outro site'};
  function label(value){return names[value]||value||'Não informado';}
  function table(items,columns,empty){
    if(!Array.isArray(items)||!items.length)return '<p class="sbw-access-empty">'+esc(empty||'Nenhum registro neste período.')+'</p>';
    return '<div class="sbw-access-table-scroll"><table><thead><tr>'+columns.map(c=>'<th scope="col">'+esc(c.title)+'</th>').join('')+'</tr></thead><tbody>'+items.map(item=>'<tr>'+columns.map(c=>'<td'+(c.numeric?' class="is-number"':'')+'>'+esc(c.format?c.format(item):item[c.key]||'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  const counts=[{title:'Visitas',numeric:true,format:i=>fmt(i.visits)},{title:'Visualizações',numeric:true,format:i=>fmt(i.views)}];
  function section(title,body,wide=false){return '<section class="sbw-access-card'+(wide?' is-wide':'')+'"><h3>'+esc(title)+'</h3>'+body+'</section>';}
  function bars(items){
    if(!Array.isArray(items)||!items.length)return '<p class="sbw-access-empty">Nenhum registro neste período.</p>';
    const max=Math.max(1,...items.map(i=>number(i.views)));
    return '<ul class="sbw-access-bars">'+items.map(i=>'<li><span>'+esc(label(i.name))+'</span><strong>'+fmt(i.views)+'</strong><span class="sbw-access-bar" aria-hidden="true"><i style="width:'+Math.min(100,number(i.views)/max*100)+'%"></i></span></li>').join('')+'</ul>';
  }
  function chart(items){
    if(!Array.isArray(items)||!items.length)return '<p class="sbw-access-empty">Sem dados.</p>';
    const max=Math.max(1,...items.map(i=>number(i.views)));
    return '<div class="sbw-access-chart" role="img" aria-label="Visualizações por dia; os valores estão na tabela abaixo.">'+items.map(i=>'<span class="sbw-access-day" title="'+esc(i.date)+' · '+fmt(i.views)+' visualizações"><i style="height:'+Math.min(100,number(i.views)/max*100)+'%"></i></span>').join('')+'</div><details class="sbw-access-daily"><summary>Consultar os números por dia</summary>'+table(items,[{title:'Data',key:'date'},...counts])+'</details>';
  }
  function render(root,data){
    root.classList.add('sbw-access-report');
    if(!data||data.ok===false){root.innerHTML='<p class="sbw-access-error" role="alert">'+esc(data?.message||'Não foi possível carregar os acessos. Tente novamente.')+'</p>';return;}
    const total=data.totals||{};
    const metrics=[['Visualizações de páginas',total.page_views],['Visitas identificadas',total.sessions],['Páginas diferentes',total.pages],['Visitas por streamers',total.streamer_sessions]];
    root.innerHTML='<div class="sbw-access-metrics">'+metrics.map(([name,value])=>'<article><span>'+esc(name)+'</span><strong>'+fmt(value)+'</strong></article>').join('')+'</div>'+
      '<p class="sbw-access-note">Dados próprios com métricas autorizadas. Uma visita é uma sessão de até 30 minutos sem atividade; não representa uma pessoa única. Datas no horário de Brasília. Testes são excluídos.</p>'+
      (number(total.page_views)===0?'<p class="sbw-access-empty" role="status">Ainda não há acessos com métricas autorizadas neste período e filtro.</p>':'')+
      '<div class="sbw-access-grid">'+
      section('Visualizações por dia',chart(data.daily),true)+
      section('Páginas visitadas',table(data.pages,[{title:'Página',key:'path'},...counts]),true)+
      section('Origem das visitas',table(data.sources,[{title:'Origem',format:i=>label(i.name)},{title:'Tipo',format:i=>kinds[i.kind]||i.kind},...counts]),true)+
      section('Links dos streamers',table(data.streamers,[{title:'Streamer',format:i=>label(i.name)},...counts],'Nenhuma visita por link de streamer neste período.'),true)+
      section('Campanhas e canais',table(data.campaigns,[{title:'Campanha',key:'name'},{title:'Canal do link',key:'medium'},...counts]),true)+
      section('Navegadores',bars(data.browsers))+section('Navegador ou aplicativo',bars(data.modes))+
      section('Dispositivos',bars(data.devices))+section('Sites que encaminharam visitas',table(data.referrers,[{title:'Site',key:'name'},...counts]))+
      '</div><p class="sbw-access-note">O navegador pode ocultar a origem. Quando não há identificação, mostramos “Direto / origem não informada”. A identificação do streamer vem do link utilizado.</p>'+
      '<details class="sbw-access-history"><summary>Histórico anterior preservado</summary><p>'+fmt(data.legacy?.page_views)+' visualizações na base anterior para este período. Esses registros não são somados às novas sessões e não permitem atribuir retroativamente a origem a um streamer.</p></details>';
  }
  function streamerOptions(select,items,value=''){
    const ids=[...new Set([...(Array.isArray(items)?items:[]),...(value?[value]:[])])];
    select.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='Todas as origens';select.append(option);
    ids.forEach(id=>{const o=document.createElement('option');o.value=id;o.textContent=label(id);select.append(o);});select.value=value;
  }
  window.SBWAccessReport={render,streamerOptions,label};
})();
