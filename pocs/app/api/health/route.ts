import { providerStatus } from '@mindme/core/server';

export const dynamic = 'force-dynamic';

// 키 '존재 여부'만 응답한다. 값·길이·접두사는 절대 싣지 않는다.
export function GET() {
  return Response.json({ ok: true, providers: providerStatus() });
}
