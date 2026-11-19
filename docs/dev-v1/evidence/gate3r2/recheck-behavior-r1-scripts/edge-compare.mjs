// recheck-behavior-r1: PC 판 '날짜 모양 줄 + 시간 없는 시스템 줄'을 지금 코드·HEAD·직전 라운드(시스템 줄 규칙 전) 모사본으로 비교
import { writeFileSync } from 'node:fs';
const cur = await import('/Users/jeongyounglee/work/repo/mindme/packages/core/src/analysis/parse.ts');
const head = await import('/tmp/recheck-r1/parse-head.ts'); // git show HEAD:packages/core/src/analysis/parse.ts
const r1 = await import('/tmp/recheck-r1/parse-r1sim.ts'); // 지금 코드에서 opensDay 만 '같은 날짜 MOBILE_LINE 일 때만 true' 로 되돌린 것
const pcDiv = '--------------- 2019년 3월 1일 금요일 ---------------';
const input = [pcDiv, '[이지우] [오후 9:00] 우리 처음 만난 날 기억나?', '2010년 1월 1일 금요일', '박서진님이 들어왔습니다.', '[박서진] [오후 9:05] 응 기억나', '[이지우] [오후 9:06] 벌써 9년이네'];
const out = { input, results: {} };
for (const [k, m] of Object.entries({ current: cur, head, previousRoundSim: r1 })) out.results[k] = m.parseKakao(input.join('\n')).messages.map((x) => [x.date, x.time, x.text]);
writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.results));
