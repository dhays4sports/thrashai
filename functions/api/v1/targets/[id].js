
import {json,requireControlAuth,controlReady,loadTarget,targetClientDetail,safeText} from '../_lib/control.js';
export async function onRequestGet(context){
  const a=await requireControlAuth(context.request,context.env);if(!a.ok)return a.response;
  if(!controlReady(context.env))return json({error:'Control plane is not configured.'},503);
  const id=safeText(context.params?.id,80),t=await loadTarget(context.env,id);if(!t)return json({error:'Target not found.'},404);
  return json({object:'target',...targetClientDetail(t.record,t.secret)});
}
