import { SAMPLE_PERSONA } from '@mindme/core';
import { chatRoute } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
// persona 가 없으면 내장 샘플(15살의 홍길동)로 대화한다.
export const POST = chatRoute({ prepare: (body) => ({ ...body, persona: body.persona ?? SAMPLE_PERSONA }) });
