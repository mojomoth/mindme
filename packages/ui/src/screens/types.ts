/** 03 목록 한 줄 */
export interface PersonaListItem {
  id: string;
  name: string;
  description: string;
  avatarSrc: string;
  avatarBg?: string;
  /** '새로운 페르소나' 표시 */
  isNew?: boolean;
}

/** 05 대화 말풍선 하나 */
export interface ChatBubbleItem {
  id: string;
  from: 'persona' | 'me';
  text: string;
  /** 표시용 시각 ('오후 2:30') */
  time: string;
}
