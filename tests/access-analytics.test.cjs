const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {randomUUID,webcrypto}=require('node:crypto');
const root=path.join(__dirname,'..');
const core=require(path.join(root,'js/analytics/access-core.js'));
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const handlerModule=import(pathToFileURL(path.join(root,'supabase/functions/sbw-track-access/access-handler.mjs')));
function consentState(saved){
 const stored=new Map([['saberwolf_esports_cookie_consent_v1:/',JSON.stringify(saved)]]);
 const storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 const window={localStorage:storage,location:{href:'https://sbwgg.com.br/'},dispatchEvent(){}};
 const document={currentScript:{src:'https://sbwgg.com.br/js/core/sbw-site-compliance.js'},querySelector:()=>null,readyState:'loading',addEventListener(){}};
 vm.runInNewContext(source('js/core/sbw-site-compliance.js'),{window,document,URL,CustomEvent:class{},console,Date});
 return window.SBWCompliance;
}
test('a migração de preferências mantém Twitch e pede aceite separado para métricas',()=>{
 const api=consentState({version:'2026-09-11-2',necessary:true,analytics:false,externalMedia:true});
 assert.equal(api.isAllowed('externalMedia'),true);assert.equal(api.isAllowed('analytics'),false);assert.equal(api.getConsent().needsAnalyticsChoice,true);
 api.saveConsent({externalMedia:true,analytics:true});assert.equal(api.isAllowed('analytics'),true);assert.equal(api.getConsent().needsAnalyticsChoice,false);
 api.saveConsent({externalMedia:true,analytics:false});assert.equal(api.isAllowed('externalMedia'),true);assert.equal(api.isAllowed('analytics'),false);
});
const base={event_id:randomUUID(),session_id:randomUUID(),event_type:'page_view',page_path:'/',consent_analytics:true,source_kind:'streamer',source_name:'tigerfurious',streamer:'tigerfurious',medium:'colaborador',campaign:'comerciais_sbw',referrer_host:'',browser:'Chrome',device:'desktop',access_mode:'browser',destination_host:'',is_test:false};
const fakeConfig={pages:['/','/pages/sobre'],origins:['https://example.test'],publicKey:'sb_publishable_test_only',projectUrl:'https://project.example.test',serverKey:'server-test-only',rateSalt:'test-salt'};
async function harness(response={ok:true,duplicate:false},status=200){
 const {createHandler}=await handlerModule,calls=[];
 const handler=createHandler(fakeConfig,{fetcher:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(response),{status});}});
 const request=(event=base,headers={},method='POST')=>new Request('https://edge.example.test',{method,headers:{origin:fakeConfig.origins[0],apikey:fakeConfig.publicKey,'content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify({event})}:{})});
 return{calls,handler,request};
}
test('o link publicado da TigerFurious é reconhecido com a campanha existente',()=>{
 const a=core.attribution('https://sbwgg.com.br/?utm_source=tigerfurious&utm_medium=colaborador&utm_campaign=comerciais_sbw');
 assert.equal(a.kind,'streamer');assert.equal(a.streamer,'tigerfurious');assert.equal(a.campaign,'comerciais_sbw');
});
test('a origem da sessão continua nas páginas seguintes, sem ser trocada por navegação interna',()=>{
 const start=1700000000000,a=core.attribution('https://sbwgg.com.br/?ref=tigerfurious');
 const first=core.session(null,a,start,randomUUID);
 const second=core.session(first,core.attribution('https://sbwgg.com.br/pages/sobre','https://sbwgg.com.br/'),start+20000,randomUUID);
 assert.equal(second.id,first.id);assert.equal(second.attribution.streamer,'tigerfurious');
});
test('30 minutos de inatividade ou outra campanha iniciam outra visita',()=>{
 const a=core.attribution('https://sbwgg.com.br/?ref=tigerfurious'),first=core.session(null,a,10000000,randomUUID);
 const expired=core.session(first,core.attribution('https://sbwgg.com.br/'),10000000+core.SESSION_MS,randomUUID);
 assert.notEqual(expired.id,first.id);assert.equal(expired.attribution.kind,'direct');
 const campaign=core.session(first,core.attribution('https://sbwgg.com.br/?utm_source=elitz&utm_medium=streamer'),10000001,randomUUID);
 assert.notEqual(campaign.id,first.id);assert.equal(campaign.attribution.streamer,'elitz');
});
test('navegador/aplicativo e fonte da visita são classificações independentes',()=>{
 assert.equal(core.client('Mozilla Chrome/130',true).mode,'pwa');
 assert.equal(core.client('Mozilla Chrome/130',false).browser,'Chrome');
 assert.equal(core.attribution('https://sbwgg.com.br/','https://www.google.com/search?q=private').kind,'search');
 assert.equal(core.attribution('https://sbwgg.com.br/','https://l.instagram.com/?secret=value').kind,'social');
});
test('consultas, tokens, e-mails e URLs privadas não entram nos caminhos e fontes',()=>{
 assert.equal(core.path('/perfis/perfil.html?id=private#access_token=secret'),'/perfis/perfil');
 assert.equal(core.path('/users/person@example.test'),'');
 assert.equal(core.path('//external.test/'),'');assert.equal(core.path('/../private'),'');
 assert.equal(core.attribution('https://sbwgg.com.br/?utm_source=private@example.test').name,'direct');
 const a=core.attribution('https://sbwgg.com.br/','https://example.org/path?token=secret');
 assert.equal(a.referrer_host,'example.org');assert.ok(!JSON.stringify(a).includes('secret'));
});
test('a atribuição atravessa as marcas sem copiar identificadores ou segredos da página atual',()=>{
 const a=core.attribution('https://sbwgg.com.br/?ref=tigerfurious&access_token=private');
 const url=new URL(core.crossSite('https://sbwchampionship.com/calendario/calendario.html','https://sbwgg.com.br',a));
 assert.equal(url.searchParams.get('utm_source'),'tigerfurious');assert.equal(url.searchParams.has('access_token'),false);
 assert.equal(core.crossSite('https://example.org/','https://sbwgg.com.br',a),'https://example.org/');
});
test('configurações dos dois sites expõem somente chaves públicas e excluem administração e callbacks',()=>{
 const context={window:{}};vm.runInNewContext(source('js/analytics/access-config.js'),context);
 const c=context.window.SBWAccessConfig;
 assert.ok(c.publicKey.startsWith('sb_publishable_'));assert.ok(c.pages.includes('/'));
 assert.equal(c.pages.includes('/admin/analytics'),false);assert.equal(c.pages.includes('/auth/callback'),false);
 assert.doesNotMatch(source('js/analytics/access-config.js'),/sb_secret_|service_role|serverKey/);
});
test('coletor valida a chave pública e a origem antes de qualquer gravação',async()=>{
 const h=await harness();
 assert.equal((await h.handler(h.request(base,{apikey:'invalid'}))).status,401);
 assert.equal((await h.handler(h.request(base,{origin:'https://attacker.test'}))).status,403);
 assert.equal(h.calls.length,0);
});
test('coletor recusa falta de consentimento, campos extras e identificadores inválidos',async()=>{
 const h=await harness();
 for(const event of [{...base,consent_analytics:false},{...base,user_id:'private'},{...base,ip:'1.2.3.4'},{...base,event_id:'invalid'},{...base,page_path:'/auth/callback?code=secret'}])assert.equal((await h.handler(h.request(event))).status,400);
 assert.equal(h.calls.length,0);
});
test('evento válido só é gravado pela RPC do servidor e a resposta não expõe dados internos',async()=>{
 const h=await harness();const response=await h.handler(h.request());
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,duplicate:false});
 assert.equal(h.calls[0].url,fakeConfig.projectUrl+'/rest/v1/rpc/sbw_record_access_event');
 assert.equal(h.calls[0].options.headers.apikey,fakeConfig.serverKey);
 assert.deepEqual(JSON.parse(h.calls[0].options.body).p_event,base);
});
test('duplicatas, expiração e indisponibilidade têm respostas controladas',async()=>{
 const duplicate=await harness({ok:true,duplicate:true});assert.equal((await (await duplicate.handler(duplicate.request())).json()).duplicate,true);
 const expired=await harness({message:'access_session_expired'},400);assert.equal((await expired.handler(expired.request())).status,409);
 const failed=await harness({message:'private server secret'},500);const result=await failed.handler(failed.request());
 assert.equal(result.status,503);assert.equal((await result.text()).includes('private server secret'),false);
});
test('tamanho do corpo é limitado e excesso de requisições não chega ao banco',async()=>{
 const h=await harness();const large=h.request({...base,campaign:'a'.repeat(5000)});assert.equal((await h.handler(large)).status,413);
 const rate=await harness();for(let n=0;n<120;n++)assert.equal((await rate.handler(rate.request())).status,200);
 assert.equal((await rate.handler(rate.request())).status,429);assert.equal(rate.calls.length,120);
});

function browser({consent=false,stored=new Map(),href='https://example.test/?utm_source=tigerfurious&utm_medium=colaborador',dnt='0'}={}){
 const listeners={},documentListeners={},timers=new Map(),calls=[];let id=0,accepted=consent;
 const storage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 const document={visibilityState:'visible',referrer:'',addEventListener:(n,fn)=>documentListeners[n]=fn};
 const location=new URL(href),navigator={userAgent:'Mozilla Chrome/130',doNotTrack:dnt};
 const window={SBWAccessCore:core,SBWAccessConfig:{...fakeConfig,site:'test',endpoint:'https://edge.example.test'},SBWCompliance:{getConsent:()=>({analytics:accepted})},matchMedia:()=>({matches:false}),addEventListener:(n,fn)=>listeners[n]=fn};
 const context=vm.createContext({window,document,location,navigator,URL,Set,Promise,Date,crypto:{randomUUID},localStorage:storage,AbortController,
  setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:n=>timers.delete(n),
  fetch:async(_url,options)=>{calls.push(JSON.parse(options.body));return{ok:true,status:200,json:async()=>({ok:true})};}});
 vm.runInContext(source('js/analytics/sbw-access-analytics.js'),context);
 return{window,calls,stored,documentListeners,context,allow(v){accepted=v;listeners['sbw:cookies-consent-updated']();},async advance(){for(const [n,t]of [...timers])if(t.ms===700){timers.delete(n);t.fn();}await new Promise(setImmediate);}};
}
test('navegador não grava nem cria sessão antes do aceite; aceite produz só uma visualização',async()=>{
 const b=browser();await b.advance();assert.equal(b.calls.length,0);assert.equal(b.stored.size,0);
 b.allow(true);await b.advance();assert.equal(b.calls.length,1);assert.equal(b.calls[0].event.streamer,'tigerfurious');
 await b.window.SBWAccessAnalytics.pageView();await b.advance();assert.equal(b.calls.length,1);
});
test('revogar o consentimento remove a sessão e bloqueia novos envios',async()=>{
 const b=browser({consent:true});await b.advance();assert.ok(b.stored.size);
 b.allow(false);assert.equal(b.stored.size,0);await b.window.SBWAccessAnalytics.pageView();assert.equal(b.calls.length,1);
});
test('Do Not Track e páginas não autorizadas permanecem sem coleta',async()=>{
 const dnt=browser({consent:true,dnt:'1'});await dnt.advance();assert.equal(dnt.calls.length,0);
 const admin=browser({consent:true,href:'https://example.test/admin/analytics'});await admin.advance();assert.equal(admin.calls.length,0);
});
test('o sinal de teste usa sessão separada e não muda a sessão de tráfego real',async()=>{
 const stored=new Map(),live=browser({consent:true,stored});await live.advance();
 const trial=browser({consent:true,stored,href:'https://example.test/?sbw_analytics_test=1'});await trial.advance();
 assert.notEqual(live.calls[0].event.session_id,trial.calls[0].event.session_id);assert.equal(trial.calls[0].event.is_test,true);assert.equal(stored.size,2);
});
