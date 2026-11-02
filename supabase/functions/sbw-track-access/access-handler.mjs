/* Coletor anônimo de acessos. A chave administrativa permanece apenas no servidor. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9_.-]{0,79}$/;
const HOST = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/;
const fields = new Set(['event_id','session_id','event_type','page_path','consent_analytics','source_kind','source_name','streamer','medium','campaign','referrer_host','browser','device','access_mode','destination_host','is_test']);
const choices = {
  event_type:['page_view','link_click'], source_kind:['direct','internal','search','social','streamer','referral','campaign'],
  browser:['Chrome','Firefox','Edge','Safari','Opera','Samsung Internet','Outro'], device:['mobile','tablet','desktop'],
  access_mode:['browser','pwa','app','embedded']
};
class Invalid extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
export function validateEvent(event,pages) {
  if(!event||typeof event!=='object'||Array.isArray(event)||Object.keys(event).some(k=>!fields.has(k)))throw new Invalid('invalid_event');
  if(event.consent_analytics!==true)throw new Invalid('consent_required');
  if(!UUID.test(event.event_id)||!UUID.test(event.session_id))throw new Invalid('invalid_id');
  if(!pages.has(event.page_path))throw new Invalid('invalid_page');
  for(const [key,values]of Object.entries(choices))if(!values.includes(event[key]))throw new Invalid('invalid_'+key);
  if(typeof event.source_name!=='string'||event.source_name.length>180||!SLUG.test(event.source_name)&&!HOST.test(event.source_name))throw new Invalid('invalid_source');
  const clean={...event};
  for(const key of ['streamer','medium','campaign']){
    const value=event[key]??'';
    if(typeof value!=='string'||value!==''&&!SLUG.test(value))throw new Invalid('invalid_'+key);
    clean[key]=value;
  }
  if((event.source_kind==='streamer')!==(clean.streamer!==''))throw new Invalid('invalid_streamer');
  if(clean.streamer&&clean.streamer!==event.source_name)throw new Invalid('invalid_streamer');
  for(const key of ['referrer_host','destination_host']){
    const value=event[key]??'';
    if(typeof value!=='string'||value.length>180||value!==''&&!HOST.test(value))throw new Invalid('invalid_'+key);
    clean[key]=value;
  }
  if('is_test'in event&&typeof event.is_test!=='boolean')throw new Invalid('invalid_test_flag');
  clean.is_test=event.is_test===true;
  return clean;
}
async function readBody(request){
  if(Number(request.headers.get('content-length'))>4096)throw new Invalid('payload_too_large',413);
  const reader=request.body?.getReader();if(!reader)throw new Invalid('invalid_payload');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Invalid('payload_too_large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Invalid('invalid_json');}
}
export function createHandler(config,{fetcher=fetch,now=Date.now}={}){
  const pages=new Set(config.pages),origins=new Set(config.origins),buckets=new Map();
  function headers(origin){return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey'};}
  const respond=(origin,status,body)=>new Response(body===null?null:JSON.stringify(body),{status,headers:headers(origin)});
  return async function handler(request){
    const origin=request.headers.get('origin')||'';
    try{
      if(!origins.has(origin))throw new Invalid('origin_not_allowed',403);
      if(request.method==='OPTIONS')return respond(origin,204,null);
      if(request.method!=='POST')throw new Invalid('method_not_allowed',405);
      // Chave pública explícita do projeto; a gravação no banco exige a chave de servidor.
      if(request.headers.get('apikey')!==config.publicKey)throw new Invalid('invalid_public_key',401);
      if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new Invalid('json_required',415);
      const stamp=now(),minute=Math.floor(stamp/60000);
      const address=(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unavailable').slice(0,180);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config.rateSalt+':'+minute+':'+address));
      const key=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      for(const [id,bucket]of buckets)if(bucket.minute!==minute)buckets.delete(id);
      if(buckets.size>=3000&&!buckets.has(key))throw new Invalid('rate_limited',429);
      const current=buckets.get(key)||{minute,count:0};if(++current.count>120)throw new Invalid('rate_limited',429);buckets.set(key,current);
      const payload=await readBody(request);
      if(!payload||Object.keys(payload).length!==1||!('event'in payload))throw new Invalid('invalid_payload');
      const event=validateEvent(payload.event,pages);
      const response=await fetcher(config.projectUrl+'/rest/v1/rpc/sbw_record_access_event',{
        method:'POST',headers:{'Content-Type':'application/json','apikey':config.serverKey,'Authorization':'Bearer '+config.serverKey},
        body:JSON.stringify({p_event:event}),signal:AbortSignal.timeout(5000)
      });
      if(!response.ok){
        const detail=await response.text();
        if(detail.includes('access_session_expired'))throw new Invalid('session_expired',409);
        throw new Invalid('storage_unavailable',503);
      }
      const result=await response.json();
      if(result?.ok!==true)throw new Invalid('storage_unavailable',503);
      return respond(origin,200,{ok:true,duplicate:result.duplicate===true});
    }catch(error){return respond(origin,error instanceof Invalid?error.status:503,{ok:false,code:error instanceof Invalid?error.code:'temporarily_unavailable'});}
  };
}
