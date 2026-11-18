// 실제 OpenAI 호출 확인용. `node --test` 대상이 아니다(파일명에 .test 없음).
// 실행: node --conditions=react-server --env-file=.env packages/core/test/llm-smoke.ts
// 키 값은 출력하지 않는다.
import { z } from 'zod';

if (!process.env.OPENAI_API_KEY?.trim()) {
  console.log('SKIP: OPENAI_API_KEY 없음');
  process.exit(0);
}

const { generateObject, streamText } = await import('../src/server/llm.ts');
const model = process.env.MINDME_TEXT_MODEL?.trim() || 'gpt-6-astra (기본값)';
console.log(`model: ${model}`);

let t = performance.now();
const obj = await generateObject({
  schema: z.object({ mood: z.enum(['기쁨', '슬픔', '불안', '평온']), reply: z.string() }),
  system: '사용자의 문장을 읽고 감정 하나를 고른 뒤, 한 문장으로 짧게 답한다.',
  input: '오늘 시험이 끝나서 홀가분해.',
});
console.log(`generateObject ${Math.round(performance.now() - t)}ms`, JSON.stringify(obj));

t = performance.now();
let first = 0;
let text = '';
let chunks = 0;
const reader = new Response(
  streamText({
    system: '15살의 나로서 반말로 두 문장 이내로 답한다.',
    messages: [{ role: 'user', content: '요즘 학교생활은 어때?' }],
  }),
).body!.pipeThrough(new TextDecoderStream()).getReader();
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  if (!first) first = performance.now() - t;
  chunks++;
  text += value;
}
console.log(`streamText first=${Math.round(first)}ms total=${Math.round(performance.now() - t)}ms chunks=${chunks}`, text);
