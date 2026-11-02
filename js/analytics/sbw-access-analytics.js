/* SBW — páginas, sessões e origem. Coleta somente após consentimento. */
(function(){
  "use strict";
  if(window.SBWAccessAnalytics)return;
  const config=window.SBWAccessConfig,core=window.SBWAccessCore;
  if(!config||!core)return;
  const isTest=new URL(location.href).searchParams.get('sbw_analytics_test')==='1';
  const sessionKey='sbw_access_session_v1:'+config.site+':'+(isTest?'test':'live');
  const pagePath=core.path(location.pathname);
  if(!config.pages.includes(pagePath))return;
  const arrival=core.attribution(location.href,document.referrer);
  const pending=new Set();let pageSent=false,timer=null,memorySession=null,generation=0;
  function allowed(){
    if(window.SBW_DISABLE_ANALYTICS===true||window.SBW_ANALYTICS_OPT_OUT===true||navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return false;
    try{return window.SBWCompliance?.getConsent?.()?.analytics===true&&localStorage.getItem('sbw_analytics_opt_out')!=='true';}catch{return window.SBWCompliance?.getConsent?.()?.analytics===true;}
  }
  function readSession(){try{return JSON.parse(localStorage.getItem(sessionKey)||'null');}catch{return memorySession;}}
  function freshSession(){
    const value=core.session(readSession(),arrival,Date.now(),()=>crypto.randomUUID());
    memorySession=value;try{localStorage.setItem(sessionKey,JSON.stringify(value));}catch{}
    return value;
  }
  function forget(){memorySession=null;try{localStorage.removeItem(sessionKey);}catch{}}
  function mode(){return core.client(navigator.userAgent,window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true);}
  async function send(kind,destinationHost='',retry=0,eventId=crypto.randomUUID()){
    if(!allowed()||document.visibilityState==='hidden')return false;
    const epoch=generation,s=freshSession(),client=mode(),source=s.attribution;
    const controller=new AbortController();pending.add(controller);
    const timeout=setTimeout(()=>controller.abort(),6000);
    const event={event_id:eventId,session_id:s.id,event_type:kind,page_path:pagePath,consent_analytics:true,
      source_kind:source.kind,source_name:source.name,streamer:source.streamer,medium:source.medium,campaign:source.campaign,
      referrer_host:source.referrer_host,browser:client.browser,device:client.device,access_mode:client.mode,destination_host:destinationHost,is_test:isTest};
    try{
      if(!allowed()||epoch!==generation)return false;
      const response=await fetch(config.endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',keepalive:true,
        headers:{'Content-Type':'application/json','apikey':config.publicKey},signal:controller.signal,body:JSON.stringify({event})});
      const result=await response.json();
      if(response.status===409&&result.code==='session_expired'&&retry===0){forget();return send(kind,destinationHost,1,eventId);}
      if(!response.ok||result.ok!==true)throw new Error('access_unavailable');
      return true;
    }catch{
      if(allowed()&&epoch===generation&&retry===0){await new Promise(resolve=>setTimeout(resolve,1200));if(allowed()&&epoch===generation)return send(kind,destinationHost,1,eventId);}
      return false;
    }finally{clearTimeout(timeout);pending.delete(controller);}
  }
  function pageView(){
    if(pageSent||!allowed()||document.visibilityState==='hidden')return Promise.resolve(false);
    pageSent=true;return send('page_view');
  }
  function sync(){
    if(!allowed()){
      generation++;if(timer)clearTimeout(timer);timer=null;
      pending.forEach(c=>c.abort());pending.clear();forget();return;
    }
    if(!pageSent&&!timer&&document.visibilityState!=='hidden')timer=setTimeout(()=>{timer=null;void pageView();},700);
  }
  function click(event){
    if(!allowed()||event.defaultPrevented||event.target?.closest?.('[data-sbw-no-track]'))return;
    const link=event.target?.closest?.('a[href]');if(!link)return;
    let target;try{target=new URL(link.href,location.href);}catch{return;}
    if(!/^https?:$/.test(target.protocol)||target.origin===location.origin)return;
    const session=freshSession();
    const attributed=core.crossSite(target.href,location.origin,session.attribution);
    if(attributed!==target.href)link.href=attributed;
    const host=core.host(target.hostname);if(host)void send('link_click',host);
    if(!pageSent)void pageView();
  }
  window.SBWAccessAnalytics={pageView,track(type){return type==='page_view'?pageView():Promise.resolve(false);},version:'2026-11-02-access-1'};
  document.addEventListener('click',click,true);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('sbw:cookies-consent-updated',sync);
  window.addEventListener('storage',event=>{if(event.key!==sessionKey)sync();});
  window.addEventListener('pageshow',sync);
  window.addEventListener('pagehide',()=>{if(timer)clearTimeout(timer);timer=null;});
  sync();
})();
