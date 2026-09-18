function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60','x-content-type-options':'nosniff'}});}
export async function onRequestGet(context){
  const kv=context.env?.THRASH_REPORTS;if(!kv)return json({error:'Public agent profiles are not configured.'},503);
  const slug=String(context.params?.slug||'').replace(/[^a-z0-9-]/gi,'').slice(0,80);
  const raw=await kv.get(`agent:${slug}`);if(!raw)return json({error:'Agent profile not found.'},404);
  try{return json({profile:JSON.parse(raw)});}catch{return json({error:'Stored agent profile is invalid.'},500);}
}
