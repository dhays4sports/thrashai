import { getPublicReport } from '../../_lib/report-store.js';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60','x-content-type-options':'nosniff'}});}
export async function onRequestGet(context){
  const id=String(context.params?.id||'').slice(0,120);
  const result=await getPublicReport(context.env||{},id);
  if(!result.ok)return json({error:result.error},result.status||500);
  return json({report:result.payload,integrity:result.integrity});
}
