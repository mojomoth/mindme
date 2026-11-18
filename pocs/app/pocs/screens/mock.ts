import { characters, type ChatBubbleItem, type PersonaListItem } from '@mindme/ui';

// 드래프트(docs/screens/drafts/prompts.json) 문구 그대로의 목업 데이터
export const personas: PersonaListItem[] = [
  { id: 'teen', name: '15살의 홍길동', description: '꿈이 많던 중학생 시절의 나', avatarSrc: characters.avatarTeen, avatarBg: '#dceaf8', isNew: true },
  { id: 'first-day', name: '첫 출근 날의 홍길동', description: '설렘과 긴장이 가득했던 하루', avatarSrc: characters.avatarYoung, avatarBg: '#fef1c5' },
  { id: 'graduation', name: '졸업식 날의 홍길동', description: '새로운 시작을 앞둔 나', avatarSrc: characters.guideAvatar, avatarBg: '#fedfd2' },
];

export const messages: ChatBubbleItem[] = [
  { id: 'm1', from: 'persona', text: '안녕! 미래의 나는\n어떻게 지내고 있어?', time: '오후 2:30' },
  { id: 'm2', from: 'me', text: '생각보다 잘 지내고 있어.\n네가 문득 보고 싶었어.', time: '오후 2:31' },
  { id: 'm3', from: 'persona', text: '정말? 나는 요즘\n새 학기가 조금 걱정돼.', time: '오후 2:31' },
  { id: 'm4', from: 'me', text: '어떤 게 제일 걱정돼?', time: '오후 2:32' },
];

export const SCREENS = [
  { id: 'landing', label: '01 랜딩' },
  { id: 'create', label: '02 페르소나 만들기' },
  { id: 'list', label: '03 페르소나 목록' },
  { id: 'modal', label: '04 생성 모달' },
  { id: 'chat', label: '05 대화' },
] as const;

export type ScreenId = (typeof SCREENS)[number]['id'];
