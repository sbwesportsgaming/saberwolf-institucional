const {chromium}=require('./node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fixture={ok:true,totals:{page_views:12,sessions:3,pages:2,streamer_sessions:2,link_clicks:1},daily:[{date:'2026-11-02',views:12,visits:3}],pages:[{path:'/',views:8,visits:3},{path:'/pages/sobre',views:4,visits:2}],sources:[{kind:'streamer',name:'tigerfurious',views:9,visits:2},{kind:'direct',name:'direct',views:3,visits:1}],streamers:[{name:'tigerfurious',views:9,visits:2}],campaigns:[{name:'comerciais_sbw',medium:'colaborador',views:9,visits:2}],browsers:[{name:'Chrome',views:10},{name:'Firefox',views:2}],devices:[{name:'mobile',views:8},{name:'desktop',views:4}],modes:[{name:'browser',views:9},{name:'pwa',views:3}],referrers:[],streamer_options:['tigerfurious'],legacy:{page_views:4}};
const sdk=`(()=>{
 let current=null;const handlers=[];
 const auth={async getSession(){return{data:{session:current},error:null};},
 async signInWithPassword({email}){current={user:{id:email==='blocked@example.test'?'non-admin':'owner-test'},access_token:'test-only',refresh_token:'test-only'};handlers.forEach(fn=>fn('SIGNED_IN',current));return{data:{session:current},error:null};},
 async signOut(){current=null;handlers.forEach(fn=>fn('SIGNED_OUT',null));return{error:null};},
 onAuthStateChange(fn){handlers.push(fn);return{data:{subscription:{unsubscribe(){}}}};}};
 window.__accessCalls=[];
 window.supabase={createClient(){return{auth,async rpc(name,params){window.__accessCalls.push({name,params});if(current?.user.id!=='owner-test')return{data:null,error:{code:'42501'}};return{data:${JSON.stringify(fixture)},error:null};}};}};
})();`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const errors=[],events=[];const base='http://127.0.0.1:8763';
 async function context(){
  const c=await browser.newContext();
  await c.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname.endsWith('/functions/v1/sbw-track-access')){
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    events.push(request.postDataJSON());return route.fulfill({contentType:'application/json',headers,body:JSON.stringify({ok:true,duplicate:false})});
   }
   if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:sdk});
   if(url.hostname!=='127.0.0.1')return route.abort();
   if(url.pathname.endsWith('.js')&&!/\/js\/(analytics\/|supabase\/(supabase-client|supabase-config)\.js|core\/(sbw-site-compliance|sbw-theme)\.js)/.test(url.pathname))return route.fulfill({contentType:'application/javascript',body:''});
   return route.continue();
  });return c;
 }
 try{
  const admin=await context(),page=await admin.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin/analytics.html');
  await page.waitForFunction(()=>!document.querySelector('[data-access-login] fieldset').disabled);
  const consent=page.locator('[data-sbw-cookie-necessary]');if(await consent.isVisible())await consent.click();
  await page.locator('#accessEmail').fill('owner@example.test');await page.locator('#accessPassword').fill('Test-password-only');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByText('Visitas identificadas',{exact:true}).waitFor();
  assert.deepEqual(await page.locator('.sbw-access-metrics strong').allTextContents(),['12','3','2','2']);
  const sizes=[];
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);sizes.push(width);}
  await page.locator('[data-access-streamer]').selectOption('tigerfurious');
  await page.waitForFunction(()=>window.__accessCalls.at(-1).params.p_streamer==='tigerfurious');
  await page.getByRole('button',{name:'30 dias',exact:true}).click();await page.waitForFunction(()=>window.__accessCalls.at(-1).params.p_days===30);
  await page.locator('[data-access-logout]').click();await page.locator('[data-access-login-panel]').waitFor();assert.equal(await page.locator('.sbw-access-metrics').count(),0);
  await page.locator('#accessEmail').fill('blocked@example.test');await page.locator('#accessPassword').fill('Test-password-only');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByText(/Esta conta não tem autorização/).waitFor();assert.equal(await page.locator('.sbw-access-metrics').count(),0);
  await admin.close();

  const visitors=await context(),traffic=await visitors.newPage();traffic.setDefaultTimeout(10000);traffic.on('pageerror',e=>errors.push(e.message));
  await traffic.goto(base+'/index.html?utm_source=tigerfurious&utm_medium=colaborador&utm_campaign=comerciais_sbw');
  await traffic.waitForFunction(()=>!!window.SBWAccessAnalytics);assert.equal(events.length,0);
  const first=traffic.waitForResponse(r=>r.url().endsWith('/functions/v1/sbw-track-access')&&r.request().method()==='POST');
  await traffic.locator('[data-sbw-cookie-accept]').click();await first;
  assert.equal(events[0].event.event_type,'page_view');assert.equal(events[0].event.streamer,'tigerfurious');assert.equal(events[0].event.campaign,'comerciais_sbw');
  const second=traffic.waitForResponse(r=>r.url().endsWith('/functions/v1/sbw-track-access')&&r.request().method()==='POST');
  await traffic.goto(base+(fs.existsSync('pages/sobre.html')?'/pages/sobre.html':'/perfis/perfis.html'));await second;
  assert.equal(events[1].event.session_id,events[0].event.session_id);assert.equal(events[1].event.streamer,'tigerfurious');
  await traffic.evaluate(()=>window.SBWCompliance.openCookiePreferences());await traffic.locator('[data-sbw-cookie-analytics]').uncheck();await traffic.locator('[data-sbw-cookie-save]').click();
  await traffic.waitForFunction(()=>window.SBWCompliance.getConsent().analytics===false);
  assert.equal(await traffic.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sbw_access_session_v1:')).length),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({responsiveWidths:sizes,adminReport:true,streamerAndPeriodFilters:true,nonAdminDenied:true,consentRequired:true,streamerPreservedAcrossPages:true,revocationClearsSession:true,realExternalCalls:false,pageErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
