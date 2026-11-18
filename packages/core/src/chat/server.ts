import 'server-only';
import type { ChatRequest } from '../schemas.ts';
import { streamText } from '../server/llm.ts';
import { upstreamFail } from '../server/http.ts';
import { buildSystemPrompt, CRISIS_FOOTER, detectCrisisInChat, trimMessages } from './index.ts';

/**
 * 검증 끝난 요청 → text/plain 스트림 응답 (POST /api/chat).
 * 첫 청크까지 기다려서, 시작 전 공급자 오류는 공통 에러 JSON(502)으로 돌려준다. 이후 오류는 연결 종료.
 * 최근 user 메시지 3개에 위기 신호가 있으면 응답 끝에 109 안내를 한 번만 붙이고(모델이 이미 썼으면 생략) X-Crisis 헤더로 알린다.
 */
export async function chatResponse({ persona, messages }: ChatRequest): Promise<Response> {
  const crisis = detectCrisisInChat(messages);
  const reader = streamText({
    system: buildSystemPrompt(persona, { crisis }),
    messages: trimMessages(messages),
  }).getReader();

  let first: ReadableStreamReadResult<Uint8Array>;
  try {
    first = await reader.read();
  } catch (err) {
    return upstreamFail('api/chat', err, '답변을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let text = '';
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      if (first.value) {
        text += decoder.decode(first.value, { stream: true });
        c.enqueue(first.value);
      }
    },
    async pull(c) {
      const { done, value } = await reader.read();
      if (!done) {
        text += decoder.decode(value, { stream: true });
        c.enqueue(value);
        return;
      }
      if (crisis && !text.includes('109')) c.enqueue(encoder.encode(CRISIS_FOOTER));
      c.close();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Crisis': crisis ? '1' : '0' },
  });
}
