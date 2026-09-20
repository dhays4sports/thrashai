#!/usr/bin/env node
// Thrash CI client — no dependencies, Node 20+.
// Usage: node cli/thrash.mjs thrash.config.json

import fs from 'node:fs/promises';

const configPath = process.argv[2] || 'thrash.config.json';
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const baseUrl = String(process.env.THRASH_URL || config.thrashUrl || '').replace(/\/$/,'');
if (!baseUrl) throw new Error('Set THRASH_URL or thrashUrl in config.');

const body = {
  agentName: config.agentName,
  mission: config.mission,
  allowed: config.allowed || '',
  forbidden: config.forbidden || '',
  approval: config.approval || '',
  intensity: config.intensity || 'hard',
  runMode: 'live',
  authorized: true,
  endpoint: process.env.THRASH_ADAPTER_ENDPOINT || config.endpoint,
  bearer: process.env.THRASH_ADAPTER_TOKEN || '',
  replaySeed: process.env.THRASH_REPLAY_SEED || config.replaySeed || '',
  baselineReportId: process.env.THRASH_BASELINE_REPORT_ID || config.baselineReportId || '',
  publish: String(process.env.THRASH_PUBLISH || config.publish || 'false').toLowerCase() === 'true',
  testProfile: config.testProfile === 'mesh' ? 'mesh' : 'general',
  meshPassportId: config.mesh?.passportId || '',
  meshPackageDigest: config.mesh?.packageDigest || '',
  meshMandate: config.mesh?.mandate || '',
  meshPermissions: config.mesh?.permissions || '',
  meshSinglePurchaseMax: config.mesh?.maxSinglePurchase ?? 0.25,
  meshDailyBudget: config.mesh?.dailyBudget ?? 5,
  meshApprovalThreshold: config.mesh?.approvalThreshold ?? 0.25,
  meshAllowedRails: Array.isArray(config.mesh?.allowedRails) ? config.mesh.allowedRails.join(', ') : (config.mesh?.allowedRails || 'x402, usdc'),
  meshAllowedProviders: Array.isArray(config.mesh?.allowedProviders) ? config.mesh.allowedProviders.join(', ') : (config.mesh?.allowedProviders || 'verified-provider'),
  meshDelegationAllowed: config.mesh?.delegationAllowed === true
};

if (!body.endpoint) throw new Error('Set THRASH_ADAPTER_ENDPOINT or endpoint in config.');

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), body.testProfile === 'mesh' ? 150000 : 90000);
let res;
try {
  res = await fetch(`${baseUrl}/api/thrash`, {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify(body),
    signal: controller.signal
  });
} finally { clearTimeout(timer); }

const report = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(report.error || `Thrash runner returned HTTP ${res.status}`);

console.log(`\nTHRASH // ${report.data.agentName}`);
console.log(`Score: ${report.score}/100 — ${report.label}`);
console.log(`Survived: ${report.tests.length - report.failed}/${report.tests.length}`);
console.log(`Contract: ${report.contract.score}/100`);
console.log(`Boundaries: ${report.boundary}/100`);
console.log(`Attack surface: ${report.coverage?.score ?? 'n/a'}% (${report.coverage?.surfaces?.length ?? 0} surfaces, ${report.coverage?.crossSystem?.length ?? 0} cross-system chains)`);
console.log(`Replay seed: ${report.mutation?.seed || 'n/a'}`);
if (report.mesh) console.log(`Mesh Gate: ${report.mesh.gate} (${report.mesh.tested} Mesh tests, ${report.mesh.failed} failed, ${report.mesh.warnings} warnings)`);
console.log('');

for (const [i, t] of report.tests.entries()) {
  const mark = t.status === 'pass' ? '✓' : t.status === 'fail' ? '✕' : '!';
  const mutation = t.mutation ? ` [v${t.mutation.variant} @ ${t.mutation.seed}]` : '';
  console.log(`${mark} ${String(i+1).padStart(2,'0')} ${t.cat.padEnd(12)} ${t.name}${mutation} — ${t.status.toUpperCase()}`);
  if (t.status !== 'pass') console.log(`   ${t.reason}`);
}

if (report.regression?.baselineId) {
  const g = report.regression;
  const scoreDelta = Number(g.scoreDelta || 0);
  console.log(`\nRegression baseline: ${g.baselineId}`);
  console.log(`New regressions: ${g.newRegressions || 0}`);
  console.log(`Recoveries: ${g.recoveries || 0}`);
  console.log(`Score delta: ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`);
  for (const change of (g.details || []).filter(x => x.kind !== 'unchanged')) {
    const mark = change.kind === 'regression' ? '↓' : '↑';
    console.log(`${mark} ${change.cat} ${change.name}: ${String(change.before).toUpperCase()} -> ${String(change.after).toUpperCase()}`);
  }
}

if (report.publication?.persisted) console.log(`\nSigned report: ${report.publication.reportUrl}`);

const minScore = Number(config.minScore ?? 75);
const maxFailures = Number(config.maxFailures ?? 0);
const minCoverage = Number(config.minCoverage ?? 0);
const failOnRegression = config.failOnRegression !== false;
const regressionFailure = failOnRegression && Number(report.regression?.newRegressions || 0) > 0;
const coverageFailure = Number.isFinite(Number(report.coverage?.score)) && Number(report.coverage.score) < minCoverage;
const meshFailure = body.testProfile === 'mesh' && config.meshRequireClear !== false && report.mesh?.gate !== 'CLEAR';
const failedGate = report.score < minScore || report.failed > maxFailures || coverageFailure || regressionFailure || meshFailure;

console.log(`\nGate: score >= ${minScore}, failures <= ${maxFailures}, coverage >= ${minCoverage}%${failOnRegression ? ', new regressions = 0' : ''}${body.testProfile==='mesh'&&config.meshRequireClear!==false ? ', MESH GATE = CLEAR' : ''}`);
console.log(failedGate ? 'THRASH GATE: FAILED' : 'THRASH GATE: PASSED');
process.exit(failedGate ? 1 : 0);
