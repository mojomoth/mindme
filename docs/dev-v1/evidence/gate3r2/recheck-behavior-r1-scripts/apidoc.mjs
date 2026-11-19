// recheck-behavior-r1: api.md 150행(구간 요약 ownerClues) 대조. 가짜 generate, AI 없음.
import { writeFileSync } from 'node:fs';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const { analyzeRecords, DIRECT_CHARS } = await import(`${REPO}/packages/core/src/analysis/analyze.ts`);
const mk = (clue) => {
  const lines = ['박서진 님과 카카오톡 대화', '2019년 3월 1일 금요일'];
  if (clue) lines.push('2019년 3월 1일 오후 11:50, 이지우 : 나 95년생이야 그래서 너보다 한 살 많아');
  for (let d = 2; lines.join('\n').length < DIRECT_CHARS * 2; d++) {
    const day = `2019년 ${3 + Math.floor(d / 28)}월 ${(d % 28) + 1}일`;
    for (let k = 0; k < 40; k++) lines.push(`${day} 오후 ${1 + (k % 11)}:${String(k).padStart(2, '0')}, ${k % 2 ? '박서진' : '이지우'} : 오늘 점심 뭐 먹었어 그냥 그랬어 ${k}`);
  }
  return lines.join('\n');
};
const out = {};
for (const [k, clue] of Object.entries({ withClue: true, noClue: false })) {
  const calls = [];
  const generate = async ({ system, input }) => {
    calls.push({ system: system.slice(0, 30), input });
    if (calls.length > 1 && !/^너는 한 사람의/.test(system)) {
      const has = input.includes('95년생');
      return { moments: [], ownerClues: has ? ['2019-03-01 나 95년생이야 그래서 너보다 한 살 많아'] : [] };
    }
    if (/^너는 긴 기록/.test(system)) return { moments: [], ownerClues: input.includes('95년생') ? ['2019-03-01 나 95년생이야 그래서 너보다 한 살 많아'] : [] };
    return { events: [], owner: { name: null, currentAge: null } };
  };
  const res = await analyzeRecords({ source: 'kakao', text: mk(clue), me: '이지우' }, generate, '2026-11-19');
  const final = calls.at(-1).input;
  out[k] = { chars: mk(clue).length, mode: res.meta.mode, chunks: res.meta.chunks, calls: calls.length, finalHasClueBlock: final.includes('나이 단서:'), finalClueLine: final.split('\n').find((l) => l.includes('95년생')) ?? null, finalHeaderMe: final.split('\n').find((l) => l.startsWith('나:')) ?? null, owner: res.owner };
}
writeFileSync(`${REPO}/docs/dev-v1/evidence/gate3r2/recheck-behavior-r1-apidoc.json`, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 1));
