import 'server-only';
import type { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { getOpenAI, MODELS } from './ai.ts';

// 앱의 텍스트 AI 호출은 모두 이 파일을 거친다. 공급자를 바꿀 때는 여기만 고친다.

type Message = { role: 'user' | 'assistant'; content: string };

// SDK 가 타임아웃·5xx·429 를 재시도한다. 1회만.
const REQUEST = { timeout: 60_000, maxRetries: 1 } as const;

const modelOf = (model?: string) => model ?? process.env.MINDME_TEXT_MODEL?.trim() ?? MODELS.openai.astra;

/** 공급자 에러를 키가 섞이지 않은 메시지로 바꾼다. 원본(cause)은 붙이지 않는다. */
function llmError(err: unknown): Error {
  const e = err as { status?: number; message?: string };
  const msg = String(e?.message ?? err).replace(/sk-[\w*.-]+/g, 'sk-***');
  return new Error(`LLM 호출 실패${e?.status ? ` (HTTP ${e.status})` : ''}: ${msg}`);
}

export async function generateObject<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  input: string;
  model?: string;
}): Promise<T> {
  let text: string;
  try {
    const res = await getOpenAI().responses.create(
      {
        model: modelOf(opts.model),
        instructions: opts.system,
        input: opts.input,
        text: { format: zodTextFormat(opts.schema, 'output') },
      },
      REQUEST,
    );
    text = res.output_text;
  } catch (err) {
    throw llmError(err);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('LLM 응답이 JSON 이 아닙니다.');
  }
  return opts.schema.parse(json);
}

/** UTF-8 텍스트 청크 스트림. Route Handler 에서 `new Response(stream)` 으로 바로 반환한다. */
export function streamText(opts: { system: string; messages: Message[]; model?: string }): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let abort: AbortController | undefined;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      abort = new AbortController();
      try {
        const events = await getOpenAI().responses.create(
          {
            model: modelOf(opts.model),
            instructions: opts.system,
            input: opts.messages.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
          },
          { ...REQUEST, signal: abort.signal },
        );
        for await (const ev of events) {
          if (ev.type === 'response.output_text.delta') controller.enqueue(encoder.encode(ev.delta));
          else if (ev.type === 'error') throw new Error(ev.message);
        }
        controller.close();
      } catch (err) {
        if (!abort.signal.aborted) controller.error(llmError(err));
      }
    },
    cancel() {
      abort?.abort();
    },
  });
}

/**
 * 이미지 편집(참조 이미지 + 프롬프트) → base64. 아바타 생성용 (gpt-image-2).
 * 이미지 생성은 오래 걸려서 SDK 재시도 없이 한 번만 부르고, 타임아웃을 따로 둔다.
 */
export async function editImage(opts: {
  images: File[];
  prompt: string;
  model?: string;
  size?: '1024x1024' | '512x512';
  format?: 'png' | 'webp' | 'jpeg';
  quality?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
}): Promise<{ b64: string; format: 'png' | 'webp' | 'jpeg' }> {
  const format = opts.format ?? 'webp';
  try {
    const res = await getOpenAI().images.edit(
      {
        model: opts.model ?? process.env.MINDME_IMAGE_MODEL?.trim() ?? MODELS.openai.image,
        image: opts.images,
        prompt: opts.prompt,
        size: opts.size ?? '1024x1024',
        quality: opts.quality ?? 'medium',
        output_format: format,
        ...(format === 'png' ? {} : { output_compression: 80 }),
        n: 1,
      },
      { timeout: opts.timeoutMs ?? 110_000, maxRetries: 0 },
    );
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('이미지 응답이 비어 있습니다.');
    return { b64, format };
  } catch (err) {
    throw llmError(err);
  }
}
