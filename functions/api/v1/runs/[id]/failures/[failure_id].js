
import {json,requireControlAuth,controlReady,safeText} from '../../../_lib/control.js';
import {getRun,getControlReport} from '../../../_lib/run-service.js';
export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const id=safeText(context.params?.id,80),fid=safeText(context.params?.failure_id,180),run=await getRun(context.env,id);if(!run)return json({error:'Run not found.'},404);
  const report=await getControlReport(context.env,id);if(!report)return json({error:'Report is not ready.'},409);
  const test=(report.tests||[]).find(t=>t.id===fid);if(!test)return json({error:'Failure/scenario not found.'},404);
  return json({object:'failure',run_id:id,scenario_id:test.id,status:test.status,cat:test.cat,name:test.name,reason:test.reason,evidence:test.evidence||[],replay:test.replay||[],trace:test.trace||[],minimal_reproducer:test.minimal_reproducer||null,mutation:test.mutation||null});
}
