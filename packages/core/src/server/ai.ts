import 'server-only';
import OpenAI from 'openai';
import { readKey } from './env.ts';

// 지금 앱이 쓰는 공급자는 OpenAI 하나다. 다른 공급자(예: 12/1 이후 Claude)는 env.ts 에 키 이름,
// 여기에 클라이언트, llm.ts 에 호출을 더하면 된다. 라우트는 llm.ts 만 부르므로 바꿀 필요가 없다.
export const MODELS = {
  openai: { astra: 'gpt-6-astra', image: 'gpt-image-2' },
} as const;

let openai: OpenAI | undefined;

// 키 이름을 명시해서 apiKey 로 넘긴다.
export const getOpenAI = () => (openai ??= new OpenAI({ apiKey: readKey('openai') }));
