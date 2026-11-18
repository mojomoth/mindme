#!/usr/bin/env node
// Gate 3 배포 Critic r1: /api/analyze 큰 입력 1회(합성 카톡 TXT ~29.9만 자, 심어 둔 사건 5건). 키 없이 배포 URL 만 부른다.
// 사용법: node docs/dev-v1/evidence/gate3/critic-remote-r1-big.mjs <scratch-dir>
import { writeFileSync } from 'node:fs';
const BASE = 'https://mindme-rho.vercel.app';
const dir = process.argv[2] ?? '.';
const days = ['일', '월', '화', '수', '목', '금', '토'];
const filler = [
  '오늘 점심 뭐 먹었어?', '김치찌개 먹었어 회사 앞에서', '퇴근하고 뭐 해?', '그냥 집에서 그림 좀 그리려고',
  '날씨 진짜 춥다', '목도리 꼭 하고 다녀', '주말에 시간 돼?', '토요일 오후는 괜찮아', '그 드라마 봤어?', '아직 못 봤어 스포 금지',
  '버스 놓쳤어 ㅠㅠ', '다음 거 금방 와', '엄마가 반찬 보내 주셨어', '좋겠다 나도 먹고 싶다', '요즘 잠을 잘 못 자', '따뜻한 우유 마시고 자 봐',
];
const planted = {
  '2010-03-02': ['[서하린] [오후 9:02] 채원아 나 오늘 부산으로 전학 첫날이었어. 아무한테도 말 못 걸고 점심 혼자 먹었어', '[윤채원] [오후 9:03] 내일은 짝꿍한테 먼저 인사해 봐'],
  '2013-11-07': ['[서하린] [오후 6:15] 수능 끝났다... 수학 망한 것 같아. 엄마 얼굴 보기가 너무 미안해', '[윤채원] [오후 6:16] 끝까지 버틴 거 잘했어'],
  '2016-05-20': ['[서하린] [오후 11:40] 미대 과제 전시에서 교수님이 내 그림 앞에서 한참 서 계셨어. 처음으로 칭찬받았어', '[윤채원] [오후 11:41] 우와 축하해!!'],
  '2019-01-02': ['[서하린] [오후 10:30] 오늘 첫 출근이었어. 하루 종일 긴장했는데 팀장님이 내 시안 좋다고 하셨어', '[윤채원] [오후 10:31] 서하린 디자이너님 최고'],
  '2024-08-15': ['[서하린] [오후 8:00] 할머니 돌아가셨어. 장례식장에서 아무 말도 못 했어', '[윤채원] [오후 8:02] 지금 갈게 기다려'],
};
let out = '윤채원 님과 카카오톡 대화\n저장한 날짜 : 2026-10-30 21:12:40\n\n';
const d = new Date(Date.UTC(2010, 0, 1));
let k = 0;
while (out.length < 296_000) {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, dd] = iso.split('-').map(Number);
  out += `--------------- ${y}년 ${m}월 ${dd}일 ${days[d.getUTCDay()]}요일 ---------------\n`;
  if (planted[iso]) out += planted[iso].join('\n') + '\n';
  for (let i = 0; i < 4; i++, k++) out += `[${k % 2 ? '윤채원' : '서하린'}] [오후 ${(k % 11) + 1}:${String(k % 60).padStart(2, '0')}] ${filler[k % filler.length]}\n`;
  d.setUTCDate(d.getUTCDate() + 1);
  if (iso > '2025-12-31') break;
}
for (const [iso, lines] of Object.entries(planted)) if (!out.includes(lines[0])) out += `--------------- ${iso} ---------------\n${lines.join('\n')}\n`;
writeFileSync(`${dir}/big-kakao.txt`, out);
const t = Date.now();
const res = await fetch(`${BASE}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'kakao', text: out, me: '서하린' }) });
const ms = Date.now() - t;
const body = await res.text();
let json = null;
try { json = JSON.parse(body); } catch {}
const result = {
  at: new Date().toISOString(), chars: out.length, status: res.status, ms, vercelId: res.headers.get('x-vercel-id'),
  meta: json?.meta ?? null, owner: json?.owner ?? null, error: json?.error ?? (json ? null : body.slice(0, 300)),
  events: (json?.events ?? []).map((e) => `${e.date} age=${e.age ?? '-'} ${e.title}`),
  hasLlm: Boolean(json?.meta?.llm),
};
console.log(JSON.stringify(result, null, 2));
