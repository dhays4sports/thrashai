
import {json} from './_lib/control.js';
export function onRequestGet(){
  return json({openapi:'3.1.0',info:{title:'THRASH Control API',version:'1.0.0',description:'Authorized AI-agent crash testing control plane. Adapter credentials stay server-side.'},servers:[{url:'https://thrashai.com/api/v1'}],paths:{
    '/targets':{get:{summary:'List authorized targets'},post:{summary:'Verify and save an authorized target'}},
    '/targets/{id}':{get:{summary:'Get one authorized target'}},
    '/runs':{get:{summary:'List runs'},post:{summary:'Start a Thrash run'}},
    '/runs/{id}':{get:{summary:'Get run status'}},
    '/runs/{id}/report':{get:{summary:'Get completed report'}},
    '/runs/{id}/failures/{failure_id}':{get:{summary:'Get one failure and reproducer'}},
    '/runs/{id}/gate':{get:{summary:'Get CLEAR, REVIEW, or HOLD deployment gate'}},
    '/runs/{id}/replay':{post:{summary:'Replay a completed run using the same mutation seed'}},
    '/compare':{get:{summary:'Compare two completed runs'}}
  },security:[{bearerAuth:[]}],components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',description:'Development control-plane token. OAuth replaces this for the Muse connector.'}}}});
}
