'use client';

import dynamic from 'next/dynamic';

const Chat = dynamic(() => import('./Chat.tsx'), { ssr: false });

export default function ChatPoc() {
  return <Chat />;
}
