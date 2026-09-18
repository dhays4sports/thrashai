function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=45','x-content-type-options':'nosniff'}});}
export async function onRequestGet(context){
  const kv=context.env?.THRASH_REPORTS;if(!kv)return json({agents:[],configured:false},200);
  let pit=[];try{pit=JSON.parse((await kv.get('pit:index'))||'[]');}catch{pit=[];}
  return json({agents:Array.isArray(pit)?pit.slice(0,50):[],configured:true});
}
