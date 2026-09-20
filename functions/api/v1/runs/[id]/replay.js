
import {json,requireControlAuth,controlReady,safeText} from '../../_lib/control.js';
import {getRun,getControlReport,queueRun} from '../../_lib/run-service.js';
export async function onRequestPost(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const id=safeText(context.params?.id,80),prior=await getRun(context.env,id),report=await getControlReport(context.env,id);if(!prior||!report)return json({error:'Completed source run not found.'},404);
  try{const run=await queueRun(context,{target_id:prior.target_id,profile:prior.profile,intensity:prior.intensity,baseline_run_id:id,replay_seed:report.mutation?.seed||prior.replay_seed||'',publish:false});return json({object:'run',replay_of:id,...run},run.status==='complete'?200:202);}catch(e){return json({error:safeText(e.message,400)},400);}
}
