function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function onRequestGet(context){
  const id=String(context.params?.id||'').slice(0,120);
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f1efe8"><title>THRASH Report</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"></head><body class="public-shell" data-report-id="${esc(id)}"><div class="noise"></div><header class="site-header"><a class="brand" href="/"><span class="brand-mark">T/</span><span class="brand-lockup"><strong>THRASH</strong><small>AUTONOMOUS SYSTEMS TEST LAB</small></span></a><nav><a href="/pit.html">Public reports</a><a href="/">Start test</a></nav></header><main id="publicReport" class="public-page"><div class="loading-block">VERIFYING SIGNED REPORT…</div></main><script src="/public-report.js" defer></script></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
