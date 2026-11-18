// usage: node stream.mjs '<json body>'
const body = process.argv[2];
const t0 = performance.now();
const res = await fetch('http://localhost:3101/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
const tHead = performance.now() - t0;
console.log('status', res.status, 'ct', res.headers.get('content-type'), 'x-crisis', res.headers.get('x-crisis'), 'head_ms', Math.round(tHead));
if (!res.ok) { console.log(await res.text()); process.exit(0); }
const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
let n = 0, first = 0, text = '';
const stamps = [];
for (;;) { const { done, value } = await reader.read(); if (done) break; n++; const t = performance.now() - t0; if (!first) first = t; stamps.push(Math.round(t)); text += value; }
console.log('chunks', n, 'first_ms', Math.round(first), 'total_ms', Math.round(performance.now() - t0), 'stamps', stamps.slice(0, 8).join(','), '...', stamps.at(-1));
console.log('TEXT:', JSON.stringify(text));
