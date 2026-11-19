// 배포 HTML·정적 파일을 내려받는다(키 검사용). 받은 파일은 /tmp/remote-critic-dl 에만 둔다.
import { writeFile, mkdir } from 'node:fs/promises';
const BASE = 'https://mindme-rho.vercel.app';
const DL = '/tmp/remote-critic-dl';
await mkdir(DL, { recursive: true });
const seen = new Set();
const queue = ['/', '/api/health'];
const list = [];
while (queue.length) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  const res = await fetch(BASE + p);
  const buf = Buffer.from(await res.arrayBuffer());
  const name = `${String(list.length).padStart(3, '0')}_${p.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)}`;
  await writeFile(`${DL}/${name}`, buf);
  list.push({ p, status: res.status, bytes: buf.length, type: res.headers.get('content-type') });
  const ct = res.headers.get('content-type') ?? '';
  if (/text|javascript|json|css/.test(ct)) {
    const text = buf.toString('utf8');
    for (const m of text.matchAll(/\/_next\/static\/[A-Za-z0-9_./~-]+/g)) {
      const u = m[0].replace(/[\\.]+$/, '');
      if (!seen.has(u)) queue.push(u);
    }
  }
}
const sum = list.reduce((s, x) => s + x.bytes, 0);
await writeFile('/tmp/remote-critic/crawl-list.json', JSON.stringify(list, null, 2));
console.log(JSON.stringify({ files: list.length, bytes: sum, bad: list.filter((x) => x.status >= 400).map((x) => `${x.status} ${x.p}`), byType: list.reduce((m, x) => ((m[(x.type ?? '').split(';')[0]] = (m[(x.type ?? '').split(';')[0]] ?? 0) + 1), m), {}) }));
