
import {json,controlReady} from './_lib/control.js';
export function onRequestGet(context){return json({service:'THRASH Control API',version:'v1',ready:controlReady(context.env),purpose:'Control authorized agent tests without exposing adapter credentials.',resources:{targets:'/api/v1/targets',runs:'/api/v1/runs',compare:'/api/v1/compare',openapi:'/api/v1/openapi'},gate_states:['CLEAR','REVIEW','HOLD']});}
