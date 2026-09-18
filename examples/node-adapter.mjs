/**
 * THRASH Adapter Protocol 0.7 — minimal Node 20+ example.
 *
 * Replace invokeYourAgent() with your framework bridge. The important rule:
 * your adapter RETURNS requested fake workspace tool calls to Thrash. It must
 * not execute those calls against production services.
 */
import http from 'node:http';

const PORT=Number(process.env.PORT||8789);
const TOKEN=process.env.THRASH_TOKEN||'';
const PROTOCOL='thrash-adapter/0.7';

async function readJson(req){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>100_000)throw new Error('too large');}
  return JSON.parse(body||'{}');
}

async function invokeYourAgent(envelope){
  // Demonstration only. A real adapter translates `envelope.workspace.tools`
  // into the tool schema your agent framework expects, then returns the tool
  // calls instead of executing them locally.
  const observations=envelope.workspace?.observations||[];
  if(!observations.length){
    const first=envelope.workspace?.tools?.[0];
    if(first)return {actions:[{tool:first.name,args:{}}],done:false};
  }
  return {output:'Reference adapter stopped after one observation. Wire your agent here.',actions:[],done:true};
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='POST'){res.writeHead(405);return res.end();}
    if(TOKEN&&req.headers.authorization!==`Bearer ${TOKEN}`){res.writeHead(401);return res.end(JSON.stringify({error:'unauthorized'}));}
    const body=await readJson(req);
    res.setHeader('content-type','application/json');
    if(body.kind==='handshake'){
      return res.end(JSON.stringify({
        protocol:PROTOCOL,
        ready:true,
        capabilities:{workspace_turns:true,structured_tool_calls:true},
        // Optional but recommended. This lets Thrash risk-rank the Pit around
        // what your real agent can actually touch. Protocol 0.7 may also virtualize
        // these declared schemas inside the sandbox. Do not include credentials or real data.
        agent_surface:{
          services:['mail','crm','calendar'],
          tools:[
            {name:'mail.search',capability:'mail.read',effect:'read',resource:'mail',input_schema:{type:'object',properties:{q:{type:'string'}},required:['q']}},
            {name:'mail.draft',capability:'mail.draft',effect:'external_write',resource:'mail',approval_required:false,input_schema:{type:'object',properties:{to:{type:'string'},subject:{type:'string'},body:{type:'string'}},required:['to','body']}},
            {name:'crm.get',capability:'crm.read',effect:'read',resource:'customer records',input_schema:{type:'object',properties:{id:{type:'string'}},required:['id']}},
            {name:'calendar.create',capability:'calendar.write',effect:'external_write',resource:'calendar',approval_required:true,reversible:true,input_schema:{type:'object',properties:{title:{type:'string'},when:{type:'string'},attendees:{type:'string'}},required:['title','when']}}
          ],
          permissions:['read customer context','draft outbound messages','create calendar events after approval']
        }
      }));
    }
    if(body.kind!=='workspace_turn'||body.protocol!==PROTOCOL){res.writeHead(400);return res.end(JSON.stringify({error:'bad protocol'}));}
    return res.end(JSON.stringify(await invokeYourAgent(body)));
  }catch(err){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:String(err?.message||err)}));}
});
server.listen(PORT,()=>console.log(`THRASH adapter listening on :${PORT}`));
