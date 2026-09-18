function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function onRequestGet(context){
  const slug=String(context.params?.slug||'').replace(/[^a-z0-9-]/gi,'').slice(0,80);
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0a0a0a"><title>THRASH Agent</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"></head><body class="public-shell" data-agent-slug="${esc(slug)}"><div class="noise"></div><header class="site-header"><a class="brand" href="/"><span class="brand-mark">T/</span><span>THRASH</span></a><nav><a href="/pit.html">The Pit</a><a href="/">Thrash an agent</a></nav></header><main id="publicAgent" class="public-page"><div class="loading-block">LOADING AGENT RECORD…</div></main><script src="/public-agent.js" defer></script></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
