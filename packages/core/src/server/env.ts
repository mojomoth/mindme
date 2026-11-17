import 'server-only';

// 키 값은 이 모듈 밖으로 내보내지 않는다. 존재 여부만 외부에 공개한다.
const KEY_NAMES = {
  anthropic: 'CLAUDE_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
} as const;

export type Provider = keyof typeof KEY_NAMES;

export function hasKey(provider: Provider): boolean {
  return Boolean(process.env[KEY_NAMES[provider]]?.trim());
}

export function providerStatus(): Record<Provider, boolean> {
  return { anthropic: hasKey('anthropic'), openai: hasKey('openai'), google: hasKey('google') };
}

/** SDK 생성자에만 넘긴다. 로그·응답에 절대 싣지 않는다. */
export function readKey(provider: Provider): string {
  const value = process.env[KEY_NAMES[provider]]?.trim();
  if (!value) throw new Error(`${KEY_NAMES[provider]} 가 설정되지 않았습니다.`);
  return value;
}
