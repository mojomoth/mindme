#!/usr/bin/env node
// remote-security 4) /api/analyze 큰 입력 1회: 합성 카톡 PC TXT 약 5.5만 자, 중간에 '나 95년생이야' 한 줄.
// summarized 경로(정리 본문 > 40,000자)에서 나이 단서가 owner.currentAge(2026 기준 31)로 살아남는지 본다.
// 사용법: node big.mjs <out-dir> [--dry]   (--dry 는 API 를 부르지 않고 길이만 계산)
import { writeFileSync } from 'node:fs';
import { parseKakao, kakaoDayBlocks, packChunks } from '/Users/jeongyounglee/work/repo/mindme/packages/core/src/analysis/parse.ts';

const BASE = 'https://mindme-rho.vercel.app';
const dir = process.argv[2] ?? '.';
const dry = process.argv.includes('--dry');
const ME = '정다온';
const FRIEND = '한유진';
const days = ['일', '월', '화', '수', '목', '금', '토'];
// 나이·연도 단서가 없는 잡담만 쓴다.
const filler = [
  '오늘 점심 뭐 먹었어?', '회사 앞 국밥집 갔어 줄이 엄청 길더라', '퇴근하고 뭐 해?', '그냥 집에서 넷플릭스 보려고',
  '비 온다더니 하나도 안 오네', '우산 괜히 들고 나왔다', '주말에 시간 돼?', '일요일 오후는 괜찮아', '그 카페 다시 가 보자', '거기 케이크 맛있었지',
  '지하철 고장 나서 지각할 뻔', '아침부터 고생했네', '고양이가 또 화분 엎었어', '사진 보내 줘 ㅋㅋ', '요즘 잠이 너무 많아', '봄이라 그런가 봐',
];
const AGE_LINE = '나 95년생이야';
const planted = {
  '2021-03-15': [`[${ME}] [오후 10:05] 오늘 드디어 이직 첫 출근했어. 너무 떨려서 점심도 거의 못 먹었어`, `[${FRIEND}] [오후 10:07] 첫날 버틴 거 대단해`],
  '2022-07-02': [`[${ME}] [오후 8:40] 혼자 사는 첫 집으로 이사 끝냈어. 박스 사이에 앉아서 좀 울었어`, `[${FRIEND}] [오후 8:41] 집들이 꼭 갈게`],
  '2023-09-20': [`[${ME}] [오후 11:12] 오늘 전사 발표 망쳤어. 목소리 떨리는 게 다 들렸을 거야`, `[${FRIEND}] [오후 11:13] 아무도 그렇게 생각 안 해`],
};
let out = `${FRIEND} 님과 카카오톡 대화\n저장한 날짜 : 2026-11-01 20:10:11\n\n`;
const d = new Date(Date.UTC(2021, 0, 4));
let k = 0;
const TARGET = 59_000;
const plantedAt = {};
let agePlaced = false;
while (out.length < TARGET) {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, dd] = iso.split('-').map(Number);
  out += `--------------- ${y}년 ${m}월 ${dd}일 ${days[d.getUTCDay()]}요일 ---------------\n`;
  for (const [key, lines] of Object.entries(planted)) if (!plantedAt[key] && iso >= key) { out += lines.join('\n') + '\n'; plantedAt[key] = iso; }
  if (!agePlaced && out.length > TARGET / 2) {
    out += `[${FRIEND}] [오후 9:30] 근데 너 나보다 언니였나?\n[${ME}] [오후 9:31] ${AGE_LINE}\n[${FRIEND}] [오후 9:31] 헐 몰랐어\n`;
    agePlaced = true;
  }
  for (let i = 0; i < 6; i++, k++) out += `[${k % 2 ? FRIEND : ME}] [오후 ${(k % 11) + 1}:${String(k % 60).padStart(2, '0')}] ${filler[k % filler.length]}\n`;
  d.setUTCDate(d.getUTCDate() + 4);
}
const missing = Object.keys(planted).filter((key) => !plantedAt[key]);
const chat = parseKakao(out, ME);
const blocks = kakaoDayBlocks(chat);
const body = blocks.join('\n\n');
const chunks = packChunks(blocks, 30_000);
const ageChunk = chunks.findIndex((c) => c.includes(AGE_LINE));
const info = {
  chars: out.length, parsedBodyChars: body.length, expectMode: body.length > 40_000 ? 'summarized' : 'direct',
  expectChunks: chunks.length, ageLineInChunk: ageChunk, ageLineOffset: out.indexOf(AGE_LINE), plantedMissing: missing, plantedAt,
  messages: chat.messages.length, me: chat.me, lastDate: chat.messages.at(-1)?.date,
};
writeFileSync(`${dir}/big-kakao.txt`, out);
if (dry) {
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
}
const t = Date.now();
const res = await fetch(`${BASE}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'kakao', text: out, me: ME }) });
const ms = Date.now() - t;
const raw = await res.text();
let json = null;
try { json = JSON.parse(raw); } catch {}
const pick = (n) => res.headers.get(n);
const result = {
  item: 'remote-security-4 analyze big', at: new Date().toISOString(), endpoint: `POST ${BASE}/api/analyze`,
  request: { ...info, ageClueLine: `[${ME}] [오후 9:31] ${AGE_LINE}`, expectedCurrentAge: 2026 - 1995, note: '원문 text 는 싣지 않음(big-kakao.txt 로 따로 저장)' },
  status: res.status, elapsedMs: ms,
  headers: { 'cache-control': pick('cache-control'), 'content-type': pick('content-type'), 'x-vercel-id': pick('x-vercel-id'), 'permissions-policy': pick('permissions-policy'), 'access-control-allow-origin': pick('access-control-allow-origin') },
  owner: json?.owner ?? null, meta: json?.meta ?? null, hasMetaLlm: Boolean(json?.meta?.llm),
  events: (json?.events ?? []).map((e) => `${e.date}${e.dateEstimated ? '(추정)' : ''} age=${e.age ?? '-'} ${e.title}`),
  error: json?.error ?? (json ? null : raw.slice(0, 300)),
  responseBytes: raw.length,
};
writeFileSync(`${dir}/analyze-response.json`, raw);
console.log(JSON.stringify(result, null, 2));
