// 브라우저 → Route Handler 호출. 사용자에게 보이는 오류는 모두 한국어로 바꿔 던진다.
import type { ChatMessage, Persona } from '@mindme/core';

const OFFLINE = '연결이 잠깐 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
const hangul = /[가-힣]/;

async function post(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error(OFFLINE);
  }
  if (res.ok) return res;
  const msg: unknown = (await res.json().catch(() => null))?.error?.message;
  if (typeof msg === 'string' && hangul.test(msg)) throw new Error(msg);
  throw new Error(res.status === 413 ? '보낸 내용이 너무 커요. 조금 줄여서 다시 해 주세요.' : '서버가 잠시 대답하지 않아요. 잠시 뒤 다시 시도해 주세요.');
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return (await post(url, body)).json() as Promise<T>;
}

/** /api/chat 스트림을 읽으며 onText(지금까지 받은 전체)를 부른다. 끝나면 전체 답변을 돌려준다. */
export async function streamChat(
  persona: Persona,
  messages: ChatMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await post('/api/chat', { persona, messages }, signal);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += value;
      onText(text);
    }
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error('답변을 받다가 끊겼어요. 다시 받아 볼게요?');
  }
  if (!text.trim()) throw new Error('답변이 비어 있어요. 다시 받아 볼게요?');
  return text;
}

export const errorText = (err: unknown) => (err instanceof Error && hangul.test(err.message) ? err.message : OFFLINE);
