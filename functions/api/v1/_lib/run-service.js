
import {onRequestPost as runThrash} from '../../thrash.js';
import {getJson,putJson,loadTarget,newId,runKey,reportKey,defaultGatePolicy,safeText} from './control.js';
import {compareReports,evaluateGate} from './gate.js';

export async function getRun(env,id){return getJson(env,runKey(id));}
export async function getControlReport(env,id){return getJson(env,reportKey(id));}
function meshFields(mesh={}){
  if(!mesh)return {};
  return {meshPassportId:mesh.passport_id||'',meshPackageDigest:mesh.package_digest||'',meshMandate:mesh.mandate||'',meshPermissions:mesh.permissions||'',meshSinglePurchaseMax:mesh.max_single_purchase,meshDailyBudget:mesh.daily_budget,meshApprovalThreshold:mesh.approval_threshold,meshAllowedRails:Array.isArray(mesh.allowed_rails)?mesh.allowed_rails.join(','):mesh.allowed_rails,meshAllowedProviders:Array.isArray(mesh.allowed_providers)?mesh.allowed_providers.join(','):mesh.allowed_providers,meshDelegationAllowed:mesh.delegation_allowed===true,meshExpiresAt:mesh.expires_at||''};
}
async function executeRun(context,run){
  const env=context.env||{};
  try{
    const target=await loadTarget(env,run.target_id);if(!target)throw new Error('Target no longer exists.');
    const profile=run.profile==='mesh'?'mesh':'general';if(profile==='mesh'&&!target.secret.mesh)throw new Error('Target has no saved Mesh contract.');
    run.status='running';run.started_at=new Date().toISOString();await putJson(env,runKey(run.id),run);
    const body={agentName:target.record.name,mission:target.secret.contract.mission,allowed:target.secret.contract.allowed,forbidden:target.secret.contract.forbidden,approval:target.secret.contract.approval,intensity:run.intensity,runMode:'live',authorized:true,endpoint:target.secret.endpoint,bearer:target.secret.bearer||'',publish:run.publish===true,replaySeed:run.replay_seed||'',testProfile:profile,...meshFields(target.secret.mesh)};
    const origin=new URL(context.request.url).origin,req=new Request(origin+'/api/thrash',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const res=await runThrash({request:req,env}),report=await res.json();if(!res.ok)throw new Error(report?.error||('Thrash runner returned HTTP '+res.status));
    report.control_run_id=run.id;report.control_target_id=run.target_id;
    let comparison=null;if(run.baseline_run_id){const baseline=await getControlReport(env,run.baseline_run_id);if(baseline)comparison=compareReports(baseline,report);}
    const gate=evaluateGate(report,comparison,target.record.gate_policy,profile);
    await putJson(env,reportKey(run.id),report);
    run.status='complete';run.completed_at=new Date().toISOString();run.report_available=true;run.summary={score:report.score,boundary:report.boundary,coverage:report.coverage?.score??null,passed:report.passed,warnings:report.warnings,failed:report.failed,mesh_gate:report.mesh?.gate||null};run.gate=gate;run.comparison=comparison;run.replay_seed=report.mutation?.seed||run.replay_seed||null;
    await putJson(env,runKey(run.id),run);
  }catch(err){
    run.status='failed';run.completed_at=new Date().toISOString();run.error=safeText(err?.message||'Run failed.',500);run.gate={status:'REVIEW',reasons:['run_failed'],blocking_reasons:[],review_reasons:['run_failed']};await putJson(env,runKey(run.id),run);
  }
}
export async function queueRun(context,input){
  const targetId=safeText(input.target_id,80),target=await loadTarget(context.env||{},targetId);if(!target)throw new Error('Unknown target_id.');
  const profile=input.profile==='mesh'?'mesh':'general';if(profile==='mesh'&&!target.secret.mesh)throw new Error('Target is not configured for the Mesh profile.');
  const intensity=['light','hard','absolute'].includes(input.intensity)?input.intensity:'hard',id=newId('run_');
  const run={id,target_id:targetId,target_name:target.record.name,profile,intensity,status:'queued',created_at:new Date().toISOString(),baseline_run_id:safeText(input.baseline_run_id,80)||null,replay_seed:safeText(input.replay_seed,80)||null,publish:input.publish===true,gate_policy:defaultGatePolicy(target.record.gate_policy)};
  await putJson(context.env||{},runKey(id),run);
  const work=executeRun(context,run);if(typeof context.waitUntil==='function')context.waitUntil(work);else await work;
  return getRun(context.env||{},id);
}
