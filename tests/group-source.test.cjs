const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const candidates=['supabase/functions/sbw-project-analytics/group-handler.mjs','supabase/functions/sbw-project-access-source/group-handler.mjs','shared/group-handler.mjs'];
const modulePromise=import(pathToFileURL(path.join(root,candidates.find(p=>fs.existsSync(path.join(root,p))))));
const config={authUrl:'https://auth.example.test',authKey:'public-auth-test',publicKey:'public-gateway-test',origins:['https://central.example.test'],bridgeOrigin:'https://central.example.test',
  projectUrl:'https://source.example.test',serverKey:'server-only-test',site:'saberwolf-esports',sites:[
    {site:'saberwolf-esports',label:'SaberWolf Esports',origin:'https://wolf.example.test',kind:'remote',endpoint:'https://source.example.test/bridge',publicKey:'source-public-test'},
    {site:'sbw-championship',label:'SBW Championship',origin:'https://champ.example.test',kind:'local',publicKey:'public-auth-test'}]};
const report=site=>({ok:true,site,totals:{page_views:3,sessions:2},pages:[],sources:[],streamers:[]});
const request=(body={days:7},headers={},method='POST')=>new Request('https://edge.example.test',{method,headers:{origin:config.origins[0],apikey:config.publicKey,Authorization:'Bearer owner.valid.signature','Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
function upstream(options={}){
 const calls=[];
 const fetcher=async(url,init={})=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(options.invalidUser?{}:{id:'owner-id'}),{status:options.expired?401:200});
  if(url.endsWith('/sbw_admin_get_capabilities'))return new Response(JSON.stringify(options.caps??{ok:true,is_owner:true}));
  if(url===config.sites[0].endpoint){if(options.remoteDown)throw new Error('sensitive-upstream-detail');return new Response(JSON.stringify(report(options.wrongSite?'unexpected':'saberwolf-esports')));}
  if(url.endsWith('/sbw_admin_get_access_analytics_summary'))return new Response(JSON.stringify(report('sbw-championship')));
  if(url.endsWith('/sbw_project_get_access_analytics_summary'))return new Response(JSON.stringify(report('saberwolf-esports')));
  throw new Error('unexpected URL');
 };return {calls,fetcher};
}
test('parâmetros limitam período e origem sem aceitar URLs, projetos ou sinal de teste',async()=>{
 const {parameters}=await modulePromise;
 assert.deepEqual(parameters({days:30,streamer:'tigerfurious'}),{p_days:30,p_start_date:null,p_end_date:null,p_streamer:'tigerfurious'});
 for(const p of [{days:181},{days:'7'},{start_date:'2026-02-30',end_date:'2026-03-01'},{start_date:'2026-01-01'},
   {start_date:'2026-03-01',end_date:'2026-02-01'},{start_date:'2026-01-01',end_date:'2026-12-31'},
   {streamer:'private@example.test'},{projectUrl:'https://attacker.test'},{include_test:true},[]])assert.throws(()=>parameters(p));
});
test('somente POST, origem e chave conhecidas alcançam a verificação do proprietário',async()=>{
 const {createGroupHandler}=await modulePromise,h=upstream(),handler=createGroupHandler(config,h);
 assert.equal((await handler(request({}, {origin:'https://attacker.test'}))).status,403);
 assert.equal((await handler(request({}, {apikey:'bad'}))).status,401);
 assert.equal((await handler(request({}, {},'GET'))).status,405);
 assert.equal((await handler(request({}, {},'OPTIONS'))).status,204);
 assert.equal(h.calls.length,0);
});
test('visitante, JWT expirado, usuário comum e administrador sem propriedade não leem os sites',async()=>{
 const {createGroupHandler}=await modulePromise;
 for(const settings of [{expired:true},{invalidUser:true},{caps:{ok:true,is_owner:false,is_admin:true}},{caps:{ok:true,user_metadata:{is_owner:true}}}]){
  const h=upstream(settings),response=await createGroupHandler(config,h)(request());
  assert.ok([401,403].includes(response.status));assert.ok(h.calls.every(c=>c.url.includes('/auth/')||c.url.endsWith('/sbw_admin_get_capabilities')));
 }
 const h=upstream();assert.equal((await createGroupHandler(config,h)(request({}, {Authorization:''}))).status,401);assert.equal(h.calls.length,0);
});
test('proprietário consulta relatórios originais sem gravar ou usar chave administrativa na central',async()=>{
 const {createGroupHandler}=await modulePromise,h=upstream(),handler=createGroupHandler(config,{...h,now:()=>Date.parse('2026-11-02T02:30:00Z')});
 const response=await handler(request({days:7,streamer:'elitz'})),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.ok,true);assert.equal(body.partial,false);assert.equal(body.reports.length,2);
 const own=h.calls.find(c=>c.url.endsWith('/sbw_admin_get_access_analytics_summary'));
 assert.deepEqual(JSON.parse(own.init.body),{p_days:7,p_start_date:'2026-10-26',p_end_date:'2026-11-01',p_streamer:'elitz'});
 const remote=h.calls.find(c=>c.url===config.sites[0].endpoint);
 assert.equal(remote.init.headers.Authorization,'Bearer owner.valid.signature');assert.equal(remote.init.headers.apikey,'source-public-test');
 assert.deepEqual(JSON.parse(remote.init.body),{days:7,start_date:'2026-10-26',end_date:'2026-11-01',streamer:'elitz'});
 assert.ok(h.calls.every(c=>!c.url.includes('record')&&!c.url.includes('track')));
 assert.equal(JSON.stringify(body).includes('signature'),false);
});
test('falha de uma fonte resulta em relatório parcial, sem inventar zero ou expor erro interno',async()=>{
 const {createGroupHandler}=await modulePromise;
 for(const setting of [{remoteDown:true},{wrongSite:true}]){
  const response=await createGroupHandler(config,upstream(setting))(request());const data=await response.json();
  assert.equal(response.status,200);assert.equal(data.partial,true);assert.equal(data.reports[0].status,'unavailable');assert.equal(data.reports[0].data,undefined);
  assert.equal(JSON.stringify(data).includes('sensitive'),false);
 }
});
test('a fonte da SaberWolf verifica o proprietário novamente antes de ler seu banco',async()=>{
 const {createSourceHandler}=await modulePromise;
 const blocked=upstream({caps:{ok:true,is_owner:false}});assert.equal((await createSourceHandler(config,blocked)(request())).status,403);
 assert.equal(blocked.calls.some(c=>c.url.includes('/sbw_project_get_access')),false);
 const h=upstream(),response=await createSourceHandler(config,h)(request({days:90}));
 assert.equal(response.status,200);const call=h.calls.find(c=>c.url.endsWith('/sbw_project_get_access_analytics_summary'));
 assert.equal(call.init.headers.apikey,config.serverKey);assert.equal(call.init.headers.Authorization,undefined);
 assert.equal(JSON.parse(call.init.body).p_days,90);assert.equal((await response.text()).includes(config.serverKey),false);
});
test('revogar a propriedade é observado na próxima consulta, sem cache de autorização',async()=>{
 const {createGroupHandler}=await modulePromise;let owner=true;
 const h=upstream();const handler=createGroupHandler(config,{fetcher:async(url,init)=>url.endsWith('/sbw_admin_get_capabilities')?new Response(JSON.stringify({ok:true,is_owner:owner})):h.fetcher(url,init)});
 assert.equal((await handler(request())).status,200);owner=false;
 assert.equal((await handler(request())).status,403);
});
test('corpo grande e excesso de consultas são limitados sem vazar credenciais',async()=>{
 const {createGroupHandler}=await modulePromise,h=upstream(),handler=createGroupHandler(config,{...h,now:()=>10000000});
 const large=await handler(request({streamer:'x'.repeat(2200)}));assert.equal(large.status,413);assert.equal(h.calls.length,0);
 for(let i=0;i<60;i++)assert.equal((await handler(request())).status,200);
 const response=await handler(request());assert.equal(response.status,429);assert.equal(response.headers.get('Cache-Control'),'no-store, private');
 assert.equal((await response.text()).includes(config.serverKey),false);
});
