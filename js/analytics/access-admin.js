/* Acesso administrativo verificado em cada relatório pelo banco. */
(function(){
  'use strict';
  const config=window.SBWAccessConfig;
  const form=document.querySelector('[data-access-login]'),login=document.querySelector('[data-access-login-panel]');
  const panel=document.querySelector('[data-access-panel]'),status=document.querySelector('[data-access-status]');
  const root=document.querySelector('[data-access-results]'),logout=document.querySelector('[data-access-logout]');
  const select=document.querySelector('[data-access-streamer]'),range=document.querySelector('[data-access-range]');
  if(!config||!form||!root||!window.supabase){if(status)status.textContent='Não foi possível carregar o acesso. Recarregue a página para tentar novamente.';return;}
  let client=window.SBWSupabase?.client;
  if(!client){
    let storage;try{storage=window.sessionStorage;}catch{storage={getItem:()=>null,setItem(){},removeItem(){}};}
    client=window.supabase.createClient(config.projectUrl,config.publicKey,{auth:{storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sbw-analytics-admin:'+config.site}});
  }
  let days=7,start=null,end=null,streamer=null,revision=0,busy=false;
  const presets=[...document.querySelectorAll('[data-access-days]')];
  function message(text,error=false){status.textContent=text;status.setAttribute('role',error?'alert':'status');}
  function setBusy(value){busy=value;form.querySelector('fieldset').disabled=value;form.querySelector('button').disabled=value;panel.setAttribute('aria-busy',String(value));}
  async function load(){
    const id=++revision;let hasSession=false;setBusy(true);message('Carregando acessos...');
    try{
      const {data:{session},error}=await client.auth.getSession();
      if(id!==revision)return;
      if(error||!session){login.hidden=false;panel.hidden=true;logout.hidden=true;root.replaceChildren();message('Entre com sua conta administrativa para consultar os dados.');return;}
      hasSession=true;
      const result=await client.rpc('sbw_admin_get_access_analytics_summary',{p_days:days,p_start_date:start,p_end_date:end,p_streamer:streamer});
      if(id!==revision)return;
      if(result.error)throw result.error;
      if(!result.data?.ok)throw new Error('report_unavailable');
      login.hidden=true;panel.hidden=false;logout.hidden=false;
      window.SBWAccessReport.render(root,result.data);
      window.SBWAccessReport.streamerOptions(select,result.data.streamer_options,streamer||'');
      message('Relatório atualizado. Horário de Brasília.');
    }catch(error){
      if(id!==revision)return;
      if(error?.code==='42501'||!hasSession){login.hidden=false;panel.hidden=true;logout.hidden=false;root.replaceChildren();}
      else{login.hidden=true;panel.hidden=false;logout.hidden=false;}
      message(error?.code==='42501'?'Esta conta não tem autorização para consultar os acessos. Entre com a conta administradora.':error?.code==='22023'?'Selecione um intervalo de até 180 dias, com a data inicial antes da final.':'Não foi possível atualizar os dados. Tente novamente.',true);
    }finally{if(id===revision)setBusy(false);}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    setBusy(true);message('Entrando...');
    try{
      const result=await client.auth.signInWithPassword({email:form.email.value.trim(),password:form.password.value});
      form.password.value='';if(result.error)throw result.error;await load();
    }catch(error){form.password.value='';message(error?.code==='email_not_confirmed'?'Confirme seu e-mail antes de entrar.':'Não foi possível entrar. Confira seu e-mail e sua senha.',true);setBusy(false);}
  });
  logout.addEventListener('click',async()=>{
    ++revision;await client.auth.signOut({scope:'local'});form.password.value='';await load();
  });
  presets.forEach(button=>button.addEventListener('click',()=>{
    days=Number(button.dataset.accessDays);start=null;end=null;range.reset();presets.forEach(b=>b.classList.toggle('is-active',b===button));void load();
  }));
  range.addEventListener('submit',event=>{event.preventDefault();if(!range.reportValidity())return;if(range.start.value>range.end.value){message('A data final deve ser igual ou posterior à inicial.',true);return;}start=range.start.value;end=range.end.value;presets.forEach(b=>b.classList.remove('is-active'));void load();});
  select.addEventListener('change',()=>{streamer=select.value||null;void load();});
  document.querySelector('[data-access-refresh]').addEventListener('click',()=>void load());
  // O callback permanece síncrono para não prender o bloqueio interno do Auth.
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++revision;root.replaceChildren();login.hidden=false;panel.hidden=true;logout.hidden=true;setBusy(false);}else if(event==='SIGNED_IN'&&!busy){setTimeout(()=>void load(),0);}});
  window.addEventListener('pagehide',()=>{form.password.value='';form.querySelector('fieldset').disabled=true;});
  window.addEventListener('pageshow',event=>{if(event.persisted)void load();});
  void load();
})();
