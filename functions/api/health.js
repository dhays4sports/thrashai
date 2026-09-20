export function onRequestGet(context) {
  const persistence = Boolean(context.env?.THRASH_REPORTS && context.env?.REPORT_SIGNING_KEY);
  return new Response(JSON.stringify({
    ok: true,
    version: '0.9.0',
    protocol: 'thrash-adapter/0.7',
    sandbox: true,
    stateful: true,
    cross_service: true,
    mutations: true,
    adaptive_discovery: true,
    synthetic_tool_harness: true,
    failure_minimization: true,
    risk_weighted_coverage: true,
    regression_memory: true,
    mesh_profile: true,
    mesh_profile_version: '1.0',
    public_reports: persistence
  }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
