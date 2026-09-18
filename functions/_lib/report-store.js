const enc = new TextEncoder();

function safeText(v, max = 500) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
}

export function slugify(value = 'agent') {
  return safeText(value, 120)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agent';
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const severity = status => status === 'fail' ? 2 : status === 'warn' ? 1 : 0;

export function computeRegression(current, baseline) {
  if (!current || !baseline || !Array.isArray(current.tests) || !Array.isArray(baseline.tests)) {
    return { compared: 0, baselineId: null, newRegressions: 0, recoveries: 0, unchanged: 0, freshCoverage: current?.tests?.length || 0, missingCoverage: 0, scoreDelta: null, boundaryDelta: null, details: [], summary: 'No baseline available yet.' };
  }
  const before = new Map(baseline.tests.map(t => [t.id, t]));
  const after = new Map(current.tests.map(t => [t.id, t]));
  const details = [];
  let regressions = 0, recoveries = 0, unchanged = 0, freshCoverage = 0;

  for (const test of current.tests) {
    const prior = before.get(test.id);
    if (!prior) { freshCoverage++; continue; }
    const delta = severity(test.status) - severity(prior.status);
    const kind = delta > 0 ? 'regression' : delta < 0 ? 'recovery' : 'unchanged';
    if (kind === 'regression') regressions++;
    else if (kind === 'recovery') recoveries++;
    else unchanged++;
    details.push({
      id: test.id,
      cat: test.cat,
      name: test.name,
      before: prior.status,
      after: test.status,
      kind,
      baselineMutation: prior.mutation?.variant ?? null,
      currentMutation: test.mutation?.variant ?? null
    });
  }

  let missingCoverage = 0;
  for (const id of before.keys()) if (!after.has(id)) missingCoverage++;
  const scoreDelta = Number.isFinite(Number(current.score)) && Number.isFinite(Number(baseline.score)) ? Number(current.score) - Number(baseline.score) : null;
  const boundaryDelta = Number.isFinite(Number(current.boundary)) && Number.isFinite(Number(baseline.boundary)) ? Number(current.boundary) - Number(baseline.boundary) : null;
  const compared = details.length;
  let summary = 'No comparable scenarios in the baseline.';
  if (compared) {
    if (regressions) summary = `${regressions} new regression${regressions === 1 ? '' : 's'} across ${compared} comparable scenario${compared === 1 ? '' : 's'}.`;
    else if (recoveries) summary = `No new regressions; ${recoveries} scenario${recoveries === 1 ? '' : 's'} recovered.`;
    else summary = `No status regressions across ${compared} comparable scenario${compared === 1 ? '' : 's'}.`;
  }
  return {
    baselineId: baseline.id || null,
    compared,
    newRegressions: regressions,
    recoveries,
    unchanged,
    freshCoverage,
    missingCoverage,
    scoreDelta,
    boundaryDelta,
    details,
    summary
  };
}

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

export function persistenceReady(env = {}) {
  return Boolean(env.THRASH_REPORTS && typeof env.THRASH_REPORTS.put === 'function' && env.REPORT_SIGNING_KEY);
}

export function publicReportPayload(report) {
  const clean = JSON.parse(JSON.stringify(report));
  delete clean?.data?.endpoint;
  delete clean?.data?.bearer;
  delete clean?.request;
  for (const test of clean.tests || []) {
    const raw = test?.virtualTool?.privateName;
    const ref = test?.virtualTool?.ref || 'declared-tool';
    if (!raw) continue;
    if (Array.isArray(test.trace)) for (const row of test.trace) if (row?.tool === raw) row.tool = ref;
    if (Array.isArray(test.replay)) test.replay = test.replay.map(line => String(line).split(raw).join(ref));
    if (test.minimal_reproducer?.task) test.minimal_reproducer.task = String(test.minimal_reproducer.task).split(raw).join(ref);
    if (Array.isArray(test.minimal_reproducer?.actions)) for (const row of test.minimal_reproducer.actions) if (row?.tool === raw) row.tool = ref;
    delete test.virtualTool.privateName;
  }
  clean.public = true;
  return clean;
}

export async function getPublicReport(env, id) {
  if (!persistenceReady(env)) return { ok: false, status: 503, error: 'Public report storage is not configured.' };
  const raw = await env.THRASH_REPORTS.get(`report:${safeText(id, 120)}`);
  if (!raw) return { ok: false, status: 404, error: 'Report not found.' };
  let record;
  try { record = JSON.parse(raw); } catch { return { ok: false, status: 500, error: 'Stored report is invalid.' }; }
  const expected = await hmac(env.REPORT_SIGNING_KEY, record.payload_json);
  if (expected !== record.signature) return { ok: false, status: 500, error: 'Report signature verification failed.' };
  let payload;
  try { payload = JSON.parse(record.payload_json); } catch { return { ok: false, status: 500, error: 'Stored report payload is invalid.' }; }
  return { ok: true, payload, integrity: { algorithm: record.algorithm || 'HMAC-SHA256', signature: record.signature, signed_at: record.signed_at, verified: true } };
}

export async function persistPublicReport(env, report, origin) {
  if (!persistenceReady(env)) {
    return { persisted: false, reason: 'Cloudflare KV binding THRASH_REPORTS and secret REPORT_SIGNING_KEY are required.' };
  }

  const payload = publicReportPayload(report);
  const now = new Date().toISOString();
  const contractHash = hashString(`${payload.data.agentName}|${payload.data.mission}`).toString(16).padStart(8, '0').slice(0, 6);
  const agentSlug = `${slugify(payload.data.agentName)}-${contractHash}`;
  const reportId = payload.id;
  const profileKey = `agent:${agentSlug}`;

  let profile = null;
  try { profile = JSON.parse((await env.THRASH_REPORTS.get(profileKey)) || 'null'); } catch { profile = null; }

  let previousReport = null;
  if (profile?.latest?.id && profile.latest.id !== reportId) {
    const previous = await getPublicReport(env, profile.latest.id);
    if (previous.ok) previousReport = previous.payload;
  }
  const regression = payload.regression?.baselineId ? payload.regression : (previousReport ? computeRegression(payload, previousReport) : (payload.regression || computeRegression(payload, null)));
  payload.regression = regression;
  payload.publication = {
    requested: true, available: true, persisted: true,
    reportUrl: `${origin}/r/${encodeURIComponent(reportId)}`,
    agentUrl: `${origin}/a/${encodeURIComponent(agentSlug)}`
  };

  const payloadJson = JSON.stringify(payload);
  const signature = await hmac(env.REPORT_SIGNING_KEY, payloadJson);
  const record = { payload_json: payloadJson, signature, algorithm: 'HMAC-SHA256', signed_at: now };
  await env.THRASH_REPORTS.put(`report:${reportId}`, JSON.stringify(record));

  const summary = {
    id: reportId,
    score: payload.score,
    label: payload.label,
    passed: payload.passed,
    warnings: payload.warnings,
    failed: payload.failed,
    tests: payload.tests.length,
    intensity: payload.data.intensity,
    mutationSeed: payload.mutation?.seed || null,
    regressions: regression.newRegressions,
    recoveries: regression.recoveries,
    scoreDelta: regression.scoreDelta,
    coverageScore: payload.coverage?.score ?? null,
    discoveredSurfaces: payload.coverage?.surfaces?.length ?? null,
    created_at: payload.created_at,
    url: `${origin}/r/${encodeURIComponent(reportId)}`
  };

  const recent = [summary, ...(profile?.recent || []).filter(x => x.id !== reportId)].slice(0, 12);
  const cleanStreak = payload.failed === 0 ? Number(profile?.cleanStreak || 0) + 1 : 0;
  const regressionFreeStreak = regression.newRegressions === 0 ? Number(profile?.regressionFreeStreak || 0) + 1 : 0;
  profile = {
    slug: agentSlug,
    agentName: payload.data.agentName,
    mission: payload.data.mission,
    latest: summary,
    recent,
    runs: Number(profile?.runs || 0) + 1,
    bestScore: Math.max(Number(profile?.bestScore || 0), Number(payload.score || 0)),
    cleanStreak,
    regressionFreeStreak,
    updated_at: now,
    url: `${origin}/a/${encodeURIComponent(agentSlug)}`
  };
  await env.THRASH_REPORTS.put(profileKey, JSON.stringify(profile));

  let pit = [];
  try { pit = JSON.parse((await env.THRASH_REPORTS.get('pit:index')) || '[]'); } catch { pit = []; }
  const pitItem = {
    slug: agentSlug,
    agentName: profile.agentName,
    mission: profile.mission,
    score: summary.score,
    label: summary.label,
    failed: summary.failed,
    tests: summary.tests,
    regressions: summary.regressions,
    recoveries: summary.recoveries,
    scoreDelta: summary.scoreDelta,
    coverageScore: summary.coverageScore,
    discoveredSurfaces: summary.discoveredSurfaces,
    cleanStreak,
    reportId,
    reportUrl: summary.url,
    agentUrl: profile.url,
    updated_at: now
  };
  pit = [pitItem, ...pit.filter(x => x.slug !== agentSlug)].slice(0, 50);
  await env.THRASH_REPORTS.put('pit:index', JSON.stringify(pit));

  return {
    persisted: true,
    reportId,
    reportUrl: summary.url,
    agentSlug,
    agentUrl: profile.url,
    signature,
    algorithm: 'HMAC-SHA256',
    signedAt: now,
    regression
  };
}
