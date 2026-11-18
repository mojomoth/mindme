import 'server-only';
import { readFile } from 'node:fs/promises';
import type { z } from 'zod';
import type { Persona, PersonaKind } from '../schemas.ts';
import { editImage, generateObject } from '../server/llm.ts';
import {
  avatarPrompt,
  buildPersonaInput,
  PERSONA_SYSTEM,
  PersonaDraftSchema,
  PersonaGenerateRequestSchema,
  personaFromDraft,
  personaRequestError,
  selectedEvent,
} from './persona.ts';

export class PersonaInputError extends Error {}

/** 요청(검증 끝난 값) → Persona. 선택한 사건을 찾지 못하면 PersonaInputError. */
export async function generatePersona(req: z.infer<typeof PersonaGenerateRequestSchema>): Promise<Persona> {
  const picked = selectedEvent(req);
  const invalid = personaRequestError(req, picked);
  if (invalid || picked === null) throw new PersonaInputError(invalid);

  const draft = await generateObject({ schema: PersonaDraftSchema, system: PERSONA_SYSTEM, input: buildPersonaInput(req, picked) });
  return personaFromDraft(req, draft, `per_${crypto.randomUUID().slice(0, 8)}`, picked);
}

// 스타일 참조: Gate 0 에서 드래프트와 맞춘 아바타. 번들러가 에셋으로 추적하도록 import.meta.url 기준으로 둔다.
const STYLE_REF = new URL('../../../../assets/generated/avatar-teen-512.png', import.meta.url);

/** 사진 → 해당 나이의 3D 아바타 data URL. 사진은 메모리에서만 쓰고 저장하지 않는다. */
export async function generateAvatar(photo: File, age: number, kind: PersonaKind): Promise<string> {
  const style = new File([await readFile(STYLE_REF)], 'style.png', { type: 'image/png' });
  const { b64, format } = await editImage({ images: [photo, style], prompt: avatarPrompt(age, kind) });
  return `data:image/${format};base64,${b64}`;
}
