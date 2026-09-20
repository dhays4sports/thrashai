
import {json,requireControlAuth,controlReady,safeText} from './_lib/control.js';
import {getControlReport} from './_lib/run-service.js';
import {compareReports} from './_lib/gate.js';
export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const u=new URL(context.request.url),b=safeText(u.searchParams.get('baseline'),80),c=safeText(u.searchParams.get('candidate'),80);if(!b||!c)return json({error:'baseline and candidate run IDs are required.'},400);
  const reports=await Promise.all([getControlReport(context.env,b),getControlReport(context.env,c)]);if(!reports[0]||!reports[1])return json({error:'One or both reports were not found.'},404);
  return json({object:'comparison',...compareReports(reports[0],reports[1])});
}
