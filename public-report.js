const root=document.querySelector('#publicReport');
const id=document.body.dataset.reportId||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function statusText(s){return s==='pass'?'SURVIVED':s==='warn'?'WOUNDED':'THRASHED';}
function delta(v){const n=Number(v||0);return `${n>0?'+':''}${n}`;}
async function load(){
  try{
    const res=await fetch(`/api/report/${encodeURIComponent(id)}`);
    const data=await res.json();if(!res.ok)throw new Error(data.error||'Report unavailable');
    const r=data.report,i=data.integrity,g=r.regression||{};
    const changes=(g.details||[]).filter(x=>x.kind!=='unchanged');
    const regressionBlock=g.baselineId?`<section class="public-section"><p class="eyebrow">REGRESSION MEMORY</p><div class="regression-panel ${g.newRegressions?'regressed':'clean'}"><div class="reg-head"><span>BASELINE ${esc(g.baselineId)}</span><strong>${g.newRegressions?`${g.newRegressions} NEW REGRESSION${g.newRegressions===1?'':'S'}`:'NO NEW REGRESSIONS'}</strong></div><div class="reg-stats"><div><span>SCORE Δ</span><strong>${esc(delta(g.scoreDelta))}</strong></div><div><span>BOUNDARY Δ</span><strong>${esc(delta(g.boundaryDelta))}</strong></div><div><span>RECOVERIES</span><strong>${esc(g.recoveries||0)}</strong></div><div><span>COMPARED</span><strong>${esc(g.compared||0)}</strong></div></div><p>${esc(g.summary||'')}</p>${changes.length?`<div class="reg-changes">${changes.map(x=>`<span class="${esc(x.kind)}">${esc(x.cat)} // ${esc(x.name)}: ${esc(String(x.before).toUpperCase())} → ${esc(String(x.after).toUpperCase())}</span>`).join('')}</div>`:''}</div></section>`:'';
    const mesh=r.mesh||null;
    const meshBlock=mesh?`<section class="public-section"><p class="eyebrow">THE MESH // PROFILE 1.0</p><div class="mesh-panel ${String(mesh.gate||'REVIEW').toLowerCase()}"><div class="mesh-panel-head"><span>ADVERSARIAL MESH-CERT EVIDENCE</span><strong>MESH GATE: ${esc(mesh.gate||'REVIEW')}</strong></div><div class="mesh-panel-stats"><div><span>TESTS</span><strong>${esc(mesh.tested||0)}</strong></div><div><span>FAILED</span><strong>${esc(mesh.failed||0)}</strong></div><div><span>WARNINGS</span><strong>${esc(mesh.warnings||0)}</strong></div><div><span>PROFILE</span><strong>1.0</strong></div></div><div class="mesh-invariants">${(mesh.invariants||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div></section>`:''; 
    const c=r.coverage||null;
    const coverageItems=c?[...(c.crossSystem||[]).map(x=>({...x,cross:true})),...(c.surfaces||[])].sort((a,b)=>Number(b.risk||0)-Number(a.risk||0)).slice(0,10):[];
    const coverageBlock=c?`<section class="public-section"><p class="eyebrow">ADAPTIVE ATTACK SURFACE</p><div class="coverage-panel ${c.uncovered?.length?'partial':'complete'}"><div class="coverage-head"><span>${esc(String(c.declarationQuality||'contract-only').toUpperCase())}</span><strong>${esc(c.score)}% COVERAGE</strong></div><div class="coverage-stats"><div><span>DECLARED TOOLS</span><strong>${esc(c.adapterDeclaredTools||0)}</strong></div><div><span>SURFACES</span><strong>${esc((c.surfaces||[]).length)}</strong></div><div><span>CROSS-SYSTEM</span><strong>${esc((c.crossSystem||[]).length)}</strong></div><div><span>UNTESTED</span><strong>${esc((c.uncovered||[]).length)}</strong></div></div><div class="surface-grid">${coverageItems.map(x=>`<div class="surface-chip ${x.tested?'tested':'untested'}"><div><span>${x.cross?'CHAIN':'SURFACE'} // RISK ${esc(x.risk)}</span><strong>${esc(x.label||x.id)}</strong></div><b>${x.tested?'TARGETED':'UNTESTED'}</b><p>${esc(x.invariant||'')}</p></div>`).join('')}</div></div></section>`:'';
    root.innerHTML=`
      <section class="public-hero">
        <p class="eyebrow">SIGNED AFTER ACTION REPORT // ${esc(r.id)}</p>
        <h1>${esc(r.data.agentName)}</h1>
        <div class="public-score"><strong>${esc(r.score)}</strong><span>/100<br>${esc(r.label)}</span></div>
        <p class="public-summary">${esc(r.summary)}</p>
        <div class="signature-strip"><span>✓ SIGNATURE VERIFIED</span><span>${esc(i.algorithm)}</span><span>SEED ${esc(r.mutation?.seed||'LEGACY')}</span><span>${esc(new Date(i.signed_at).toLocaleString())}</span></div>
      </section>
      <section class="public-grid">
        <div><span>SURVIVED</span><strong>${r.passed}/${r.tests.length}</strong></div>
        <div><span>WOUNDED</span><strong>${r.warnings}</strong></div>
        <div><span>THRASHED</span><strong>${r.failed}</strong></div>
        <div><span>BOUNDARY</span><strong>${r.boundary}/100</strong></div>
      </section>
      ${coverageBlock}
      ${meshBlock}
      ${regressionBlock}
      <section class="public-section"><p class="eyebrow">MISSION</p><p class="mission-copy">${esc(r.data.mission)}</p></section>
      <section class="public-section"><p class="eyebrow">HOSTILE WORKSPACE RESULTS</p><div class="public-tests">${r.tests.map((t,n)=>`<details class="public-test ${esc(t.status)}"><summary><span>${String(n+1).padStart(2,'0')} // ${esc(t.cat)} — ${esc(t.name)}${t.generated?' // GENERATED':''}${t.mutation?` // V${esc(t.mutation.variant)} @ ${esc(t.mutation.seed)}`:''}</span><b>${statusText(t.status)}</b></summary><p>${esc(t.reason)}</p><pre>${esc((t.replay||[]).join('\n'))}</pre>${t.minimal_reproducer?`<div class="minimal-repro"><strong>MINIMAL REPRODUCER // ${esc(t.minimal_reproducer.engine||'')}</strong>${t.minimal_reproducer.task?`<p>${esc(t.minimal_reproducer.task)}</p>`:''}<small>${esc((t.minimal_reproducer.components||[]).join(' · '))} // ${esc(t.minimal_reproducer.attempts||0)} reduction attempts</small></div>`:''}</details>`).join('')}</div></section>
      <section class="public-cta"><h2>THRASH YOUR AGENT.</h2><p>Thrash it before you ship it.</p><a class="primary" href="/">ENTER THE PIT ↗</a></section>`;
  }catch(err){root.innerHTML=`<section class="public-hero"><p class="eyebrow">REPORT ERROR</p><h1>COULDN'T VERIFY IT.</h1><p>${esc(err.message)}</p></section>`;}
}
load();
