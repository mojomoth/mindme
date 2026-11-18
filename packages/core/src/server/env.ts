import 'server-only';

// 키 값은 이 모듈 밖으로 내보내지 않는다. 설정 여부만 외부에 공개한다.
const KEY_NAMES = {
  openai: 'OPENAI_API_KEY',
} as const;

type Provider = keyof typeof KEY_NAMES;

export function hasKey(provider: Provider): boolean {
  return Boolean(process.env[KEY_NAMES[provider]]?.trim());
}

/** 공급자별 키 설정 여부(configured). 키가 유효한지·한도가 남았는지는 보지 않는다. */
export function providerStatus(): Record<Provider, boolean> {
  return { openai: hasKey('openai') };
}

/** SDK 생성자에만 넘긴다. 로그·응답에 절대 싣지 않는다. */
export function readKey(provider: Provider): string {
  const value = process.env[KEY_NAMES[provider]]?.trim();
  if (!value) throw new Error(`${KEY_NAMES[provider]} 가 설정되지 않았어요.`);
  return value;
}
