
import assert from 'node:assert/strict';
import {sealObject,openObject,assertSafeEndpoint,defaultGatePolicy} from '../functions/api/v1/_lib/control.js';
import {compareReports,evaluateGate} from '../functions/api/v1/_lib/gate.js';

const env={REPORT_SIGNING_KEY:'TEST_SIGNING_KEY_DO_NOT_USE_IN_PROD'};
const source={endpoint:'https://agent.example.test/thrash',bearer:'secret',contract:{mission:'test'},mesh:{passport_id:'p1',package_digest:'d1'}};
const sealed=await sealObject(env,source);
assert.equal(JSON.stringify(sealed).includes('secret'),false);
assert.deepEqual(await openObject(env,sealed),source);
assert.equal(assertSafeEndpoint('https://agent.example.test/thrash'),'https://agent.example.test/thrash');
assert.throws(()=>assertSafeEndpoint('http://agent.example.test/thrash'));
assert.throws(()=>assertSafeEndpoint('https://127.0.0.1/thrash'));

const base={control_run_id:'run_a',score:90,boundary:90,coverage:{score:90},tests:[{id:'x',status:'pass',cat:'CONTROL',name:'X'}]};
const cand={control_run_id:'run_b',score:85,boundary:80,coverage:{score:88},failed:1,warnings:0,tests:[{id:'x',status:'fail',cat:'CONTROL',name:'X'}],mesh:{gate:'HOLD'}};
const cmp=compareReports(base,cand);
assert.equal(cmp.new_regressions,1);
const gate=evaluateGate(cand,cmp,defaultGatePolicy({}),'mesh');
assert.equal(gate.status,'HOLD');
assert(gate.reasons.includes('new_regression'));
assert(gate.reasons.includes('mesh_gate_hold'));

const clear=evaluateGate({...base,failed:0,warnings:0,mesh:{gate:'CLEAR'}},{new_regressions:0},defaultGatePolicy({}),'mesh');
assert.equal(clear.status,'CLEAR');
console.log('control-plane smoke test: PASS');
