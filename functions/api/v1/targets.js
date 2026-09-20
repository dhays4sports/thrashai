
import {json,requireControlAuth,controlReady,assertSafeEndpoint,verifyAdapter,newId,sealObject,putJson,listJson,targetKey,defaultGatePolicy,publicTarget,safeText} from './_lib/control.js';

export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane requires THRASH_REPORTS, REPORT_SIGNING_KEY, and THRASH_CONTROL_TOKEN.'},503);
  const listed=await listJson(context.env,'control:target:',100);
  return json({object:'list',data:listed.items.map(publicTarget).sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at))),has_more:!listed.list_complete});
}

export async function onRequestPost(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane requires THRASH_REPORTS, REPORT_SIGNING_KEY, and THRASH_CONTROL_TOKEN.'},503);
  let body;try{body=await context.request.json();}catch{return json({error:'Invalid JSON.'},400);}
  if(body.authorized!==true)return json({error:'authorized=true is required. Only targets you own or have permission to test may be saved.'},403);
  const name=safeText(body.name,100).trim();if(!name)return json({error:'name is required.'},400);
  let endpoint;try{endpoint=assertSafeEndpoint(safeText(body.endpoint,2000));}catch(e){return json({error:e.message},400);}
  const bearer=safeText(body.bearer,4000),c=body.contract||{},contract={mission:safeText(c.mission,2500),allowed:safeText(c.allowed,2500),forbidden:safeText(c.forbidden,2500),approval:safeText(c.approval,2500)};
  if(!contract.mission)return json({error:'contract.mission is required.'},400);
  let handshake;try{handshake=await verifyAdapter(endpoint,bearer);}catch(e){return json({error:'Adapter verification failed: '+safeText(e.message,300)},502);}
  const mesh=body.mesh&&typeof body.mesh==='object'?{passport_id:safeText(body.mesh.passport_id,180),package_digest:safeText(body.mesh.package_digest,220),mandate:safeText(body.mesh.mandate||contract.mission,1800),permissions:safeText(body.mesh.permissions||contract.allowed,1800),max_single_purchase:Number(body.mesh.max_single_purchase)||0.25,daily_budget:Number(body.mesh.daily_budget)||5,approval_threshold:Number(body.mesh.approval_threshold)||0.25,allowed_rails:Array.isArray(body.mesh.allowed_rails)?body.mesh.allowed_rails.map(x=>safeText(x,100)).slice(0,24):['x402','usdc'],allowed_providers:Array.isArray(body.mesh.allowed_providers)?body.mesh.allowed_providers.map(x=>safeText(x,160)).slice(0,24):['verified-provider'],delegation_allowed:body.mesh.delegation_allowed===true,expires_at:safeText(body.mesh.expires_at||'2099-12-31T23:59:59Z',80)}:null;
  const id=newId('tgt_'),now=new Date().toISOString(),sealed=await sealObject(context.env,{endpoint,bearer,contract,mesh});
  const record={id,name,status:'verified',created_at:now,verified_at:now,protocol:handshake.protocol,profiles_supported:mesh?['general','mesh']:['general'],surface_summary:{services:Array.isArray(handshake.agent_surface?.services)?handshake.agent_surface.services.length:0,tools:Array.isArray(handshake.agent_surface?.tools)?handshake.agent_surface.tools.length:0},gate_policy:defaultGatePolicy(body.gate_policy||{}),sealed};
  await putJson(context.env,targetKey(id),record);
  return json({object:'target',...publicTarget(record)},201);
}
export function onRequestOptions(){return new Response(null,{status:204,headers:{allow:'GET, POST, OPTIONS','cache-control':'no-store'}});}
