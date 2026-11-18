'use client';

import { Conversation, Landing, PersonaCreate, PersonaList, PersonaModal, PhoneFrame, webNative } from '@mindme/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { messages as initialMessages, personas, SCREENS, type ScreenId } from './mock';
import styles from './screens.module.css';

const href = (id: ScreenId) => `/pocs/screens/${id}`;

/** 화면 이동만 하는 데모. AI 호출 없음. */
export function ScreensDemo({ screen }: { screen: ScreenId }) {
  return (
    <>
      <nav className={styles.side} aria-label="화면 목록">
        <strong>화면</strong>
        {SCREENS.map((s) => (
          <Link key={s.id} href={href(s.id)} aria-current={s.id === screen ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      <PhoneFrame>
        <Screen screen={screen} />
      </PhoneFrame>
    </>
  );
}

function Screen({ screen }: { screen: ScreenId }) {
  const router = useRouter();
  const go = (id: ScreenId) => router.push(href(id));

  switch (screen) {
    case 'landing':
      return <LandingDemo onNext={() => go('create')} />;
    case 'create':
      return <CreateDemo onBack={() => go('landing')} onSubmit={() => go('list')} />;
    case 'list':
    case 'modal':
      return (
        <ListDemo
          modal={screen === 'modal'}
          onSelect={() => go('chat')}
          onCreate={() => go('modal')}
          onCloseModal={() => go('list')}
        />
      );
    case 'chat':
      return <ChatDemo onLeave={() => go('list')} />;
  }
}

function LandingDemo({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    // ?hold 가 있으면 멈춘다 (스크린샷용)
    if (new URLSearchParams(window.location.search).has('hold')) return;
    const t = setTimeout(onNext, 3000);
    return () => clearTimeout(t);
  }, [onNext]);
  return <Landing onSkip={onNext} />;
}

function CreateDemo({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  const [story, setStory] = useState('');
  const [fileName, setFileName] = useState<string>();
  const [photo, setPhoto] = useState<string>();
  return (
    <PersonaCreate
      story={story}
      onStoryChange={setStory}
      fileName={fileName}
      onPickFile={async () => setFileName((await webNative.pickFile('.txt,text/plain'))?.name ?? fileName)}
      photoSrc={photo}
      onPickPhoto={async () => {
        const file = await webNative.pickFile('image/*');
        if (file) setPhoto(URL.createObjectURL(file));
      }}
      onBack={onBack}
      onSubmit={onSubmit}
    />
  );
}

function ListDemo(props: { modal: boolean; onSelect: () => void; onCreate: () => void; onCloseModal: () => void }) {
  const [situation, setSituation] = useState('새 학기가 시작된 날,\n친구에게 먼저 말을 걸고 싶었던 나.');
  const [age, setAge] = useState(15);
  return (
    <PersonaList personas={personas} onSelect={props.onSelect} onCreate={props.onCreate} onChats={props.onSelect}>
      {props.modal && (
        <PersonaModal
          situation={situation}
          onSituationChange={setSituation}
          age={age}
          onAgeChange={setAge}
          onClose={props.onCloseModal}
          onSubmit={props.onCloseModal}
        />
      )}
    </PersonaList>
  );
}

function ChatDemo({ onLeave }: { onLeave: () => void }) {
  const [list, setList] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const teen = personas[0]!;
  return (
    <Conversation
      persona={teen}
      startCaption="15살의 나와 대화를 시작했어요"
      messages={list}
      typing
      draft={draft}
      onDraftChange={setDraft}
      onSend={() => {
        const time = new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
        setList((l) => [...l, { id: `m${l.length + 1}`, from: 'me', text: draft.trim(), time }]);
        setDraft('');
      }}
      onBack={onLeave}
      onExit={onLeave}
    />
  );
}
