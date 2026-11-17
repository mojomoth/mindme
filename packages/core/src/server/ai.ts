import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { readKey } from './env.ts';

// 확인된 모델 ID. 용도별 선택은 Gate 1 PoC 결과로 확정한다.
export const MODELS = {
  anthropic: { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' },
  openai: { astra: 'gpt-6-astra', sol: 'gpt-6.1-sol', image: 'gpt-image-2' },
  google: { flash: 'gemini-3.5-flash', pro: 'gemini-3.1-pro-preview', image: 'gemini-3.1-flash-image' },
} as const;

// 키 이름이 SDK 기본값(ANTHROPIC_API_KEY 등)과 다르므로 apiKey 를 명시 전달한다.
let anthropic: Anthropic | undefined;
let openai: OpenAI | undefined;
let google: GoogleGenAI | undefined;

export const getAnthropic = () => (anthropic ??= new Anthropic({ apiKey: readKey('anthropic') }));
export const getOpenAI = () => (openai ??= new OpenAI({ apiKey: readKey('openai') }));
export const getGoogle = () => (google ??= new GoogleGenAI({ apiKey: readKey('google') }));
