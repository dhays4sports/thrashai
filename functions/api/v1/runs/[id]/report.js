
import {json,requireControlAuth,controlReady,safeText} from '../../_lib/control.js';
import {getRun,getControlReport} from '../../_lib/run-service.js';
export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const id=safeText(context.params?.id,80),run=await getRun(context.env,id);if(!run)return json({error:'Run not found.'},404);
  if(run.status!=='complete')return json({error:'Report is not ready.',status:run.status},409);
  const report=await getControlReport(context.env,id);return report?json({object:'report',run_id:id,gate:run.gate,comparison:run.comparison,report}):json({error:'Report not found.'},404);
}
