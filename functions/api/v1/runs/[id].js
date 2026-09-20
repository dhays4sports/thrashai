
import {json,requireControlAuth,controlReady,safeText} from '../_lib/control.js';
import {getRun} from '../_lib/run-service.js';
export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const run=await getRun(context.env,safeText(context.params?.id,80));
  return run?json({object:'run',...run}):json({error:'Run not found.'},404);
}
