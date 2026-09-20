
import {json,requireControlAuth,controlReady,listJson,safeText} from './_lib/control.js';
import {queueRun} from './_lib/run-service.js';

export async function onRequestPost(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  let body;try{body=await context.request.json();}catch{return json({error:'Invalid JSON.'},400);}
  try{const run=await queueRun(context,body||{});return json({object:'run',...run},run.status==='complete'?200:202);}catch(e){return json({error:safeText(e.message,400)},400);}
}
export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const url=new URL(context.request.url),targetId=safeText(url.searchParams.get('target_id'),80),listed=await listJson(context.env,'control:run:',100);
  let data=listed.items;if(targetId)data=data.filter(x=>x.target_id===targetId);data.sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at)));
  return json({object:'list',data,has_more:!listed.list_complete});
}
export function onRequestOptions(){return new Response(null,{status:204,headers:{allow:'GET, POST, OPTIONS','cache-control':'no-store'}});}
