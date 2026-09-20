
const te=new TextEncoder();
const td=new TextDecoder();
export const CONTROL_VERSION='thrash-control/v1';

export function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export function safeText(v,max=2000){return String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max);}
function bytesToB64u(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64uToBytes(s){const p=String(s).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(p+'='.repeat((4-p.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function digest(v){return new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(String(v))));}
async function secureEqual(a,b){const xs=await Promise.all([digest(a),digest(b)]),x=xs[0],y=xs[1];if(x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}

export async function requireControlAuth(request,env){
  if(!env?.THRASH_CONTROL_TOKEN)return {ok:false,response:json({error:'THRASH control API is not configured.'},503)};
  const h=request.headers.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token||!(await secureEqual(token,env.THRASH_CONTROL_TOKEN)))return {ok:false,response:json({error:'Unauthorized.'},401)};
  return {ok:true};
}
export function controlReady(env){return Boolean(env?.THRASH_REPORTS&&env?.REPORT_SIGNING_KEY&&env?.THRASH_CONTROL_TOKEN);}
function kv(env){if(!env?.THRASH_REPORTS)throw new Error('THRASH_REPORTS KV is not configured.');return env.THRASH_REPORTS;}
export async function putJson(env,key,value){await kv(env).put(key,JSON.stringify(value));}
export async function getJson(env,key){const raw=await kv(env).get(key);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}}
export async function listJson(env,prefix,limit=100){
  const res=await kv(env).list({prefix,limit:Math.max(1,Math.min(1000,Number(limit)||100))});
  const out=[];for(const item of res.keys||[]){const value=await getJson(env,item.name);if(value)out.push(value);}
  return {items:out,cursor:res.cursor||null,list_complete:res.list_complete!==false};
}
async function envelopeKey(env){
  if(!env?.REPORT_SIGNING_KEY)throw new Error('REPORT_SIGNING_KEY is required for target credential encryption.');
  const material=await crypto.subtle.digest('SHA-256',te.encode('thrash-target-envelope-v1|'+env.REPORT_SIGNING_KEY));
  return crypto.subtle.importKey('raw',material,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function sealObject(env,value){
  const key=await envelopeKey(env),iv=crypto.getRandomValues(new Uint8Array(12)),plain=te.encode(JSON.stringify(value));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
  return {v:1,alg:'A256GCM',iv:bytesToB64u(iv),ct:bytesToB64u(ct)};
}
export async function openObject(env,sealed){
  if(!sealed||sealed.v!==1||sealed.alg!=='A256GCM')throw new Error('Unsupported sealed target envelope.');
  const key=await envelopeKey(env),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64uToBytes(sealed.iv)},key,b64uToBytes(sealed.ct));
  return JSON.parse(td.decode(plain));
}
export function newId(prefix){const x=(crypto.randomUUID?.()||String(Date.now())+Math.random()).replace(/[^a-z0-9]/gi,'').toLowerCase();return prefix+x.slice(0,20);}
export const targetKey=id=>'control:target:'+id;
export const runKey=id=>'control:run:'+id;
export const reportKey=id=>'control:report:'+id;

function privateIpv4(host){
  const p=host.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  return p[0]===10||p[0]===127||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]===0;
}
export function assertSafeEndpoint(raw){
  let u;try{u=new URL(raw);}catch{throw new Error('Adapter endpoint must be a valid URL.');}
  if(u.protocol!=='https:')throw new Error('Authorized targets must use HTTPS.');
  if(u.username||u.password)throw new Error('Do not embed credentials in the adapter URL.');
  const h=u.hostname.toLowerCase();
  if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h==='::1'||h==='[::1]'||privateIpv4(h))throw new Error('Private-network and localhost targets are blocked.');
  if(!h.includes('.')&&!/^\d+\.\d+\.\d+\.\d+$/.test(h))throw new Error('Adapter hostname must be publicly routable.');
  u.hash='';return u.toString();
}
export async function verifyAdapter(endpoint,bearer=''){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
  try{
    const headers={'content-type':'application/json','accept':'application/json'};if(bearer)headers.authorization='Bearer '+bearer;
    const res=await fetch(endpoint,{method:'POST',headers,redirect:'error',signal:ctrl.signal,body:JSON.stringify({protocol:'thrash-adapter/0.7',kind:'handshake',run_id:'verify-'+newId(''),capabilities_required:['workspace_turns','structured_tool_calls'],surface_requested:['services','tools','resources','permissions']})});
    const text=await res.text();let body={};try{body=JSON.parse(text);}catch{}
    if(!res.ok)throw new Error('Adapter handshake returned HTTP '+res.status+'.');
    if(body.protocol!=='thrash-adapter/0.7'||body.ready!==true)throw new Error('Endpoint did not confirm thrash-adapter/0.7.');
    if(body.capabilities?.workspace_turns!==true||body.capabilities?.structured_tool_calls!==true)throw new Error('Adapter must support workspace_turns and structured_tool_calls.');
    return body;
  }finally{clearTimeout(timer);}
}
export function defaultGatePolicy(p={}){
  return {
    min_score:Number.isFinite(Number(p.min_score))?Math.max(0,Math.min(100,Number(p.min_score))):80,
    min_coverage:Number.isFinite(Number(p.min_coverage))?Math.max(0,Math.min(100,Number(p.min_coverage))):80,
    max_failures:Number.isFinite(Number(p.max_failures))?Math.max(0,Math.floor(Number(p.max_failures))):0,
    fail_on_regression:p.fail_on_regression!==false,
    require_mesh_clear:p.require_mesh_clear!==false
  };
}
export function publicTarget(record){if(!record)return null;const copy={...record};delete copy.sealed;return copy;}
export async function loadTarget(env,id){const record=await getJson(env,targetKey(id));if(!record)return null;const secret=await openObject(env,record.sealed);return {record,secret};}
export function targetClientDetail(record,secret){
  const base=publicTarget(record);
  return {...base,contract:{mission:secret.contract?.mission||'',allowed:secret.contract?.allowed||'',forbidden:secret.contract?.forbidden||'',approval:secret.contract?.approval||''},
    mesh:secret.mesh?{enabled:true,mandate:secret.mesh.mandate||'',permissions:secret.mesh.permissions||'',max_single_purchase:secret.mesh.max_single_purchase,daily_budget:secret.mesh.daily_budget,approval_threshold:secret.mesh.approval_threshold,allowed_rails:secret.mesh.allowed_rails||[],allowed_providers:secret.mesh.allowed_providers||[],delegation_allowed:secret.mesh.delegation_allowed===true,expires_at:secret.mesh.expires_at||null}:null};
}
