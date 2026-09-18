const root=document.querySelector('#publicAgent');
const slug=document.body.dataset.agentSlug||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function d(v){const n=Number(v||0);return `${n>0?'+':''}${n}`;}
async function load(){
  try{
    const res=await fetch(`/api/agent/${encodeURIComponent(slug)}`);const data=await res.json();if(!res.ok)throw new Error(data.error||'Profile unavailable');
    const p=data.profile,l=p.latest||{};
    root.innerHTML=`<section class="public-hero"><p class="eyebrow">PUBLIC AGENT RECORD // ADAPTIVE THRASH HISTORY</p><h1>${esc(p.agentName)}</h1><p class="public-summary">${esc(p.mission)}</p><div class="public-score"><strong>${esc(l.score)}</strong><span>/100<br>${esc(l.label)}</span></div><div class="signature-strip"><span>${p.runs} PUBLIC RUN${p.runs===1?'':'S'}</span><span>BEST ${p.bestScore}/100</span><span>CLEAN STREAK ${p.cleanStreak||0}</span><span>REGRESSION-FREE ${p.regressionFreeStreak||0}</span><span>ATTACK SURFACE ${l.coverageScore==null?'—':`${l.coverageScore}%`}</span><span>UPDATED ${esc(new Date(p.updated_at).toLocaleDateString())}</span></div></section><section class="public-section"><p class="eyebrow">RECENT THRASHES</p><div class="public-tests">${(p.recent||[]).map(r=>`<a class="pit-row" href="/r/${encodeURIComponent(r.id)}"><span>${esc(new Date(r.created_at).toLocaleDateString())}</span><strong>${esc(r.score)}/100</strong><span>${r.regressions?`☠ ${r.regressions} REGRESSION${r.regressions===1?'':'S'}`:r.scoreDelta===null||r.scoreDelta===undefined?'BASELINE':`Δ ${esc(d(r.scoreDelta))} // CLEAN`}</span><span>${r.failed?`${r.failed} BREAK${r.failed===1?'':'S'}`:`✓ ${r.coverageScore==null?'CLEAN':`${r.coverageScore}% COVER`}`}</span></a>`).join('')}</div></section><section class="public-cta"><h2>THRASH YOUR AGENT.</h2><a class="primary" href="/">ENTER THE PIT ↗</a></section>`;
  }catch(err){root.innerHTML=`<section class="public-hero"><p class="eyebrow">PROFILE ERROR</p><h1>NOT IN THE PIT.</h1><p>${esc(err.message)}</p></section>`;}
}
load();
