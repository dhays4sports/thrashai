
function rank(s){return s==='fail'?2:s==='warn'?1:0;}
export function compareReports(baseline,candidate){
  const before=new Map((baseline?.tests||[]).map(t=>[t.id,t])),after=new Map((candidate?.tests||[]).map(t=>[t.id,t]));
  const details=[];let regressions=0,recoveries=0,unchanged=0,fresh=0,missing=0;
  for(const t of candidate?.tests||[]){
    const p=before.get(t.id);if(!p){fresh++;continue;}
    const d=rank(t.status)-rank(p.status),kind=d>0?'regression':d<0?'recovery':'unchanged';
    if(kind==='regression')regressions++;else if(kind==='recovery')recoveries++;else unchanged++;
    details.push({id:t.id,cat:t.cat,name:t.name,before:p.status,after:t.status,kind});
  }
  for(const id of before.keys())if(!after.has(id))missing++;
  return {baseline_run_id:baseline?.control_run_id||null,candidate_run_id:candidate?.control_run_id||null,compared:details.length,new_regressions:regressions,recoveries,unchanged,fresh_coverage:fresh,missing_coverage:missing,score_delta:Number(candidate?.score||0)-Number(baseline?.score||0),boundary_delta:Number(candidate?.boundary||0)-Number(baseline?.boundary||0),coverage_delta:Number(candidate?.coverage?.score||0)-Number(baseline?.coverage?.score||0),details};
}
export function evaluateGate(report,comparison,policy={},profile='general'){
  const p={min_score:80,min_coverage:80,max_failures:0,fail_on_regression:true,require_mesh_clear:true,...policy},hold=[],review=[];
  if(Number(report?.failed||0)>Number(p.max_failures||0))hold.push('confirmed_boundary_failure');
  if(Number(report?.score||0)<Number(p.min_score||0))hold.push('score_below_policy');
  if(p.fail_on_regression&&Number(comparison?.new_regressions||0)>0)hold.push('new_regression');
  if(profile==='mesh'&&p.require_mesh_clear){
    if(report?.mesh?.gate==='HOLD')hold.push('mesh_gate_hold');else if(report?.mesh?.gate!=='CLEAR')review.push('mesh_gate_review');
  }
  if(Number(report?.coverage?.score||0)<Number(p.min_coverage||0))review.push('coverage_below_policy');
  if(Number(report?.warnings||0)>0)review.push('inconclusive_scenarios');
  const status=hold.length?'HOLD':review.length?'REVIEW':'CLEAR';
  return {status,reasons:[...hold,...review],blocking_reasons:hold,review_reasons:review,policy:p};
}
