(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  let prototype = params.get('mode') === 'prototype';
  const exporting = params.get('mode') === 'export';
  const mascot = 'assets/mindme-guide.png';
  const LANDING_DELAY_MS = 3000;
  const state = {
    screen: params.get('screen') || 'landing', file: null, photo: '',
    selected: 0, modalOrigin: 'personas', timer: null,
    personas: [
      {name: '15살의 홍길동', age: 15, context: '중학교 시절', year: '2009년', preview: '그때의 너에게, 하고 싶은 말이 있나요?', color: ''},
      {name: '첫 출근 날의 홍길동', age: 25, context: '새로운 시작', year: '2019년', preview: '조금 서툴렀지만, 참 열심이었던 날.', color: 'lilac'},
      {name: '30살의 홍길동', age: 30, context: '지금의 나', year: '2024년', preview: '오늘은 어떤 하루를 보냈어?', color: 'mint'}
    ],
    messages: new Map()
  };
  const screens = [
    {id:'landing', title:'랜딩', en:'HELLO, ME', note:'<b>다정한 첫인상.</b> 가이드 캐릭터와 브랜드를 중심으로 구성.<br>3초 후 생성 화면으로 이동하며, 터치하면 바로 시작합니다.'},
    {id:'create', title:'페르소나 생성', en:'CREATE', note:'<b>기록에서 시작하는 만남.</b> 파일, 프롬프트, 사진 순서로 입력.<br>가이드 캐릭터가 안내하고, 하단의 생성 버튼으로 이어집니다.'},
    {id:'personas', title:'페르소나 생성 확인', en:'MY PERSONAS', note:'<b>친구 목록처럼 익숙하게.</b> 이름·시점·대화 미리보기를 표시.<br>목록 선택 시 대화로, 하단 버튼 선택 시 생성 모달로 이동합니다.'},
    {id:'modal', title:'페르소나 생성 팝업', en:'A NEW MOMENT', note:'<b>새로운 순간을 더하기.</b> 목록 위에 중앙 모달을 표시.<br>상황 설명과 나이를 선택하고, 새로운 페르소나를 만듭니다.'},
    {id:'chat', title:'대화하기', en:'TALK TO MYSELF', note:'<b>마음에 집중하는 대화.</b> 상대 프로필과 좌우 말풍선을 구분.<br>오른쪽 위 나가기 버튼을 누르면 페르소나 목록으로 돌아갑니다.'}
  ];
  const icon = (name, cls='') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const avatar = (color='', size='', photo=false) => `<span class="avatar ${color} ${size}"><img src="${photo && state.photo ? state.photo : mascot}" alt="${photo && state.photo ? '업로드한 내 얼굴' : '꽃을 단 노란 가이드 캐릭터'}"></span>`;
  const wordmark = () => '<span class="wordmark"><span class="mini-flower" aria-hidden="true">✳</span>mindme</span>';
  const status = () => '<div class="status-bar" aria-hidden="true"><span>9:41</span><div class="status-icons"><span class="signal"><i></i><i></i><i></i><i></i></span><svg class="wifi" viewBox="0 0 20 16"><path d="M1 5a15 15 0 0 1 18 0l-2 2a12 12 0 0 0-14 0Zm4 4a9 9 0 0 1 10 0l-2 2a5 5 0 0 0-6 0Zm3 4a3 3 0 0 1 4 0l-2 3Z"/></svg><span class="battery"></span></div></div>';
  const appbar = () => `<div class="app-bar">${wordmark()}<span class="step-indicator" aria-label="나를 만나는 첫 단계"><i></i><i></i><i></i></span></div>`;
  function landing() {
    return `<div class="landing-top">A LITTLE CLOSER TO MYSELF</div>
      <div class="landing-art"><span class="float-star" aria-hidden="true">✦</span><span class="float-dot"></span><span class="float-dot second"></span><img class="mascot" src="${mascot}" alt="편지를 들고 반갑게 손을 흔드는 Mindme 가이드"></div>
      <div class="landing-copy"><div class="wordmark">mindme</div><h2>나의 모든 순간에게,<br>안녕.</h2><p>그때의 나와 지금의 나,<br>마음을 잇는 작은 대화.</p></div>
      <div class="landing-loading"><div class="loader"><i></i><i></i><i></i></div><span>나를 만날 준비를 하고 있어요</span></div>
      <button class="landing-tap" data-action="start" aria-label="기다리지 않고 페르소나 생성 시작하기"></button>`;
  }
  function create() {
    return `${appbar()}<form id="create-form"><div class="create-content">
      <h2 class="page-heading">어떤 나를<br>만나볼까요?</h2>
      <div class="guide-card"><img class="mascot" src="${mascot}" alt="마음을 안내하는 캐릭터"><div><b>안녕, 나는 너의 마음 길잡이야!</b><p>일기나 대화, 짧은 기억도 좋아.<br>만나고 싶은 너를 들려줄래?</p></div></div>
      <div class="upload-field"><label class="field-label" for="record-file"><span>나의 기록 <em>선택</em></span><small>TXT</small></label>
        <label class="upload-box" for="record-file"><span class="upload-icon">${icon('file')}</span><span class="upload-copy"><strong id="file-name">일기나 대화 기록을 올려주세요</strong><small id="file-description">.txt 파일 · 최대 10MB</small></span>${icon('upload')}</label>
        <input class="sr-only" id="record-file" type="file" accept=".txt,text/plain"><p class="inline-error" id="file-error" hidden></p>
      </div>
      <div class="prompt-field"><label class="field-label" for="create-prompt"><span>만나고 싶은 나</span><small>기록 또는 설명 중 하나 입력</small></label><div class="textarea-wrap"><textarea class="text-input" id="create-prompt" maxlength="1000" placeholder="예) 열다섯 살, 친구 관계가 고민이었던 나.&#10;그때의 마음을 가만히 들어주고 싶어요."></textarea><span class="prompt-counter"><span id="prompt-count">0</span> / 1,000</span></div><p class="inline-error" id="prompt-error" hidden>기록을 올리거나 만나고 싶은 나를 적어주세요.</p></div>
      <div class="photo-row"><label class="photo-picker" for="face-photo" aria-label="내 얼굴 사진 업로드">${avatar('', '', true)}<span class="camera-badge">${icon('camera')}</span></label><div class="photo-description"><strong>내 얼굴 사진 <span style="color:#9ba49e;font-weight:400;font-size:10px">선택</span></strong><p>사진이 없으면 캐릭터로 시작해요</p></div><button class="text-button" type="button" data-action="photo">사진 올리기</button><input id="face-photo" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp"><p class="sr-only" id="photo-status" role="status"></p></div>
      </div><div class="bottom-action"><button class="primary-button" id="create-submit" type="submit">나의 페르소나 만들기 ${icon('arrow')}</button><p class="bottom-caption">${icon('heart')} 너의 이야기를, 너의 속도로.</p></div></form>`;
  }
  function personaRows() {
    return state.personas.map((p,i) => `<button class="persona-row" data-action="talk" data-persona="${i}" aria-label="${escape(p.name)}와 대화하기">${avatar(p.color,'',true)}<span class="persona-info"><h3>${escape(p.name)}</h3><span class="persona-meta"><span class="persona-tag">${escape(p.context)}</span><span>${escape(p.year)}</span></span><p>${escape(p.preview)}</p></span>${icon('back')}</button>`).join('');
  }
  function personas(isModal=false) {
    return `<div ${isModal ? 'inert aria-hidden="true"' : ''}>${appbar()}<div class="personas-content"><h2 class="page-heading">다시 만나는 나 <span class="tiny-flower" aria-hidden="true">✳</span></h2><p class="page-subtitle">서로 다른 시간 속, 모두 소중한 나예요.</p><div class="welcome-card"><p>마음이 가는 순간의 나에게<br>말을 걸어보세요.</p><span>EVERY VERSION OF YOU</span><img class="mascot" src="${mascot}" alt=""></div><div class="list-heading"><span>나의 페르소나 <b>${state.personas.length}</b></span><small>나를 닮은 작은 친구들</small></div><div class="persona-list">${personaRows()}</div></div><div class="bottom-action"><button class="primary-button" data-action="open-modal">${icon('plus')} 새 페르소나 만들기</button><p class="bottom-caption">나의 모든 순간을, 조금 더 다정하게.</p></div></div>`;
  }
  function modal() {
    return `${personas(true)}<div class="modal-backdrop"><section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><button class="icon-button modal-close" data-action="close-modal" aria-label="페르소나 생성 모달 닫기">${icon('close')}</button><div class="modal-symbol">${icon('spark')}</div><h2 id="modal-title">어느 순간의 나인가요?</h2><p class="page-subtitle" id="modal-description">기억 속 한 장면을 꺼내, 새로운 나를 만나봐요.</p><form id="modal-form"><div class="modal-field"><label class="field-label" for="situation">그때의 이야기를 들려주세요</label><textarea class="text-input" id="situation" maxlength="1000" placeholder="예) 새 학기 첫날, 낯선 교실에서&#10;친구에게 먼저 말을 걸기 어려웠던 나."></textarea><p class="inline-error" id="situation-error" hidden>만나고 싶은 순간을 한 줄 이상 적어주세요.</p></div><div class="age-field"><label class="field-label" for="persona-age"><span>그때의 나이</span><output class="age-value" for="persona-age">15살</output></label><input class="age-range" id="persona-age" type="range" min="5" max="80" value="15" aria-valuetext="15살"><div class="range-labels"><span>5살</span><span>40살</span><span>80살</span></div></div><button class="primary-button" type="submit">${icon('spark')} 이 순간의 나 만들기</button><p class="modal-privacy">조금 서툰 기억이어도 괜찮아요.</p></form></section></div>`;
  }
  function incoming(p, content, time='오후 2:31') {
    return `<div class="message incoming">${avatar(p.color,'tiny',true)}<div class="message-main"><div class="message-name">${escape(p.name)}</div><div class="bubble">${content}</div><time class="message-time">${time}</time></div></div>`;
  }
  function initialConversation(p) {
    if (state.selected !== 0) return incoming(p, `안녕, 나는 ${escape(p.name)}이야.<br>지금 나에게 어떤 이야기를 해주고 싶어?`);
    return `${incoming(p,'안녕! 이렇게 만나니까 조금 신기하다. ☺<br>미래의 나는 어떻게 지내고 있어?')}
      <div class="message outgoing"><div class="message-main"><div class="bubble">잘 지내고 있어. 문득 그때의 내가<br>어땠는지 궁금해졌어.</div><time class="message-time">오후 2:32</time></div></div>
      ${incoming(p,'사실 요즘 친구들 사이에서<br>혼자인 것 같을 때가 있어.<br>그냥, 내 얘기를 들어줄 사람이<br>있었으면 좋겠어.','오후 2:32')}`;
  }
  function chat() {
    const p=state.personas[state.selected];
    return `<header class="chat-header">${avatar(p.color,'small',true)}<div class="chat-profile"><h2>${escape(p.name)}</h2><p><i></i> 그때의 나와, 지금의 나</p></div><button class="icon-button leave-chat" data-action="leave" aria-label="대화 나가기">${icon('exit')}</button></header><div class="conversation" role="log" aria-label="${escape(p.name)}와의 대화" aria-live="polite"><p class="date-label">11월 17일 화요일</p><div class="chat-memory">${icon('spark')} ${escape(p.age)}살의 나와 마음을 잇는 중</div><div class="messages">${initialConversation(p)}${state.messages.get(state.selected)||''}</div></div><footer class="chat-footer"><div class="chat-suggestions"><button class="suggestion" data-suggestion="그때 많이 외로웠겠다.">그때 많이 외로웠겠다</button><button class="suggestion" data-suggestion="지금은 어떤 마음이야?">지금은 어떤 마음이야?</button></div><form class="message-composer" id="chat-form"><label class="sr-only" for="chat-input">대화 메시지</label><textarea id="chat-input" rows="1" maxlength="2000" placeholder="그때의 나에게 말을 건네보세요"></textarea><button class="send-button" type="submit" aria-label="메시지 보내기">${icon('send')}</button></form><p class="chat-caption">AI로 만든 페르소나와 나누는 대화예요.</p></footer>`;
  }
  const renderers = {landing,create,personas,modal,chat};
  function render() {
    document.body.classList.toggle('prototype',prototype);
    document.body.classList.toggle('export',exporting);
    document.getElementById('screen-grid').innerHTML=screens.map((s,i)=>`<section class="screen-frame ${s.id===state.screen?'active':''}" data-screen="${s.id}" aria-label="${s.title}"><div class="screen-label"><span class="screen-number">0${i+1}</span><h2>${s.title}</h2><span>${s.en}</span></div><div class="device ${s.id} ${s.id==='modal'?'personas':''}">${status()}<div class="screen-body">${renderers[s.id]()}</div><div class="home-indicator" aria-hidden="true"></div></div><p class="screen-note">${s.note}</p></section>`).join('');
    bindForms();
    if(prototype && state.screen==='landing') startTimer();
  }
  function show(screen) {
    clearTimeout(state.timer);
    if(!screens.some(s=>s.id===screen)) screen='landing';
    state.screen=screen;
    document.querySelectorAll('.screen-frame').forEach(s=>s.classList.toggle('active',s.dataset.screen===screen));
    if(screen==='personas'||screen==='modal'||screen==='chat') refresh(screen);
    if(prototype) history.replaceState(null,'',`?mode=prototype&screen=${screen}`);
    if(prototype && screen==='modal') setTimeout(()=>document.querySelector('#situation').focus(),40);
    if(prototype && screen==='landing') startTimer();
  }
  function refresh(screen) {
    const target=document.querySelector(`[data-screen="${screen}"] .screen-body`);
    target.innerHTML=renderers[screen]();bindForms();
  }
  function startTimer() {clearTimeout(state.timer);state.timer=setTimeout(()=>show('create'),LANDING_DELAY_MS);}
  function toast(message) {
    const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2800);
  }
  function closeModal() {
    if(prototype) {show(state.modalOrigin);document.querySelector('[data-screen="personas"] [data-action="open-modal"]').focus();}
    else {toast('모달 닫기 · 프로토타입에서 전체 흐름을 확인하세요.');}
  }
  function go(screen) {
    if(!prototype){prototype=true;document.body.classList.add('prototype');window.scrollTo(0,0);}
    show(screen);
  }
  document.addEventListener('click',e=>{
    const suggestion=e.target.closest('[data-suggestion]');
    if(suggestion) {const input=document.querySelector('#chat-input');input.value=suggestion.dataset.suggestion;input.focus();return;}
    const action=e.target.closest('[data-action]');if(!action)return;
    switch(action.dataset.action) {
      case 'start':go('create');break;
      case 'photo':document.querySelector('#face-photo').click();break;
      case 'talk':state.selected=Number(action.dataset.persona);go('chat');break;
      case 'open-modal':state.modalOrigin='personas';go('modal');break;
      case 'close-modal':closeModal();break;
      case 'leave':go('personas');break;
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&state.screen==='modal'&&prototype)closeModal();
    if(e.key==='Tab'&&prototype&&state.screen==='modal'){
      const dialog=document.querySelector('.modal-dialog');
      const focusable=[...dialog.querySelectorAll('button,input,textarea')].filter(el=>!el.disabled);
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  function bindForms() {
    const createForm=document.querySelector('#create-form');
    createForm.onsubmit=e=>{
      e.preventDefault();const input=document.querySelector('#create-prompt');
      if(!state.file&&!input.value.trim()) {document.querySelector('#prompt-error').hidden=false;input.focus();return;}
      document.querySelector('#prompt-error').hidden=true;
      const submit=document.querySelector('#create-submit');submit.disabled=true;submit.textContent='기억 속의 나를 만나러 가는 중…';
      setTimeout(()=>{submit.disabled=false;submit.innerHTML=`나의 페르소나 만들기 ${icon('arrow')}`;go('personas');toast('페르소나가 준비됐어요. 만나고 싶은 나를 골라보세요.');},700);
    };
    document.querySelector('#create-prompt').oninput=e=>{document.querySelector('#prompt-count').textContent=e.target.value.length;document.querySelector('#prompt-error').hidden=true;};
    document.querySelector('#record-file').onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      const error=document.querySelector('#file-error');
      if(!/\.txt$/i.test(file.name)||file.size>10*1024*1024) {error.textContent='10MB 이하의 .txt 파일을 선택해주세요.';error.hidden=false;e.target.value='';return;}
      error.hidden=true;state.file=file;document.querySelector('#file-name').textContent=file.name;document.querySelector('#file-description').textContent='기록이 준비됐어요 · 다시 눌러 변경';document.querySelector('#prompt-error').hidden=true;
    };
    document.querySelector('#face-photo').onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024) {toast('10MB 이하의 JPG, PNG, WEBP 사진을 선택해주세요.');e.target.value='';return;}
      const reader=new FileReader();reader.onload=()=>{state.photo=reader.result;const img=document.querySelector('.photo-picker img');img.src=state.photo;img.alt='업로드한 내 얼굴';document.querySelector('#photo-status').textContent='얼굴 사진이 업로드됐어요.';toast('사진이 준비됐어요.');};reader.readAsDataURL(file);
    };
    document.querySelector('#persona-age').oninput=e=>{
      const age=Number(e.target.value);document.querySelector('.age-value').textContent=`${age}살`;e.target.setAttribute('aria-valuetext',`${age}살`);const percent=(age-5)/75*100;e.target.style.background=`linear-gradient(to right,var(--coral) 0% ${percent}%,#e7eae4 ${percent}% 100%)`;
    };
    document.querySelector('#situation').oninput=()=>{document.querySelector('#situation-error').hidden=true;};
    document.querySelector('#modal-form').onsubmit=e=>{
      e.preventDefault();const situation=document.querySelector('#situation');
      if(!situation.value.trim()){document.querySelector('#situation-error').hidden=false;situation.focus();return;}
      const age=Number(document.querySelector('#persona-age').value);
      state.personas.unshift({name:`${age}살의 홍길동`,age,context:'새로운 기억',year:'나의 한 장면',preview:situation.value.trim(),color:'lilac'});
      state.messages=new Map([...state.messages].map(([k,v])=>[k+1,v]));
      refresh('personas');
      if(prototype)show('personas');else{refresh('modal');toast('새 페르소나를 목록에 추가했어요.');}
    };
    document.querySelector('#chat-form').onsubmit=sendMessage;
    document.querySelector('#chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendMessage(e);}};
  }
  function sendMessage(e) {
    e.preventDefault();const input=document.querySelector('#chat-input');const value=input.value.trim();if(!value)return;
    const index=state.selected;const p=state.personas[index];
    const time=new Date().toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'});
    const html=`<div class="message outgoing"><div class="message-main"><div class="bubble">${escape(value).replace(/\n/g,'<br>')}</div><time class="message-time">${time}</time></div></div>`;
    state.messages.set(index,(state.messages.get(index)||'')+html);
    document.querySelector('.messages').insertAdjacentHTML('beforeend',html);input.value='';
    document.querySelector('.messages').insertAdjacentHTML('beforeend',`<div class="message typing" aria-label="답변 입력 중">${avatar(p.color,'tiny',true)}<div class="bubble"><span>●</span> <span>●</span> <span>●</span></div></div>`);
    scrollChat();
    setTimeout(()=>{
      const reply=incoming(p,'그렇게 말해주니까 마음이 조금 놓인다.<br>내 이야기를 들어줘서 고마워. ☺',time);
      state.messages.set(index,(state.messages.get(index)||'')+reply);
      if(state.selected===index){document.querySelector('.typing')?.remove();document.querySelector('.messages')?.insertAdjacentHTML('beforeend',reply);scrollChat();}
    },900);
  }
  function scrollChat(){const box=document.querySelector('.conversation');box.scrollTop=box.scrollHeight;}
  document.querySelector('.reset-prototype').onclick=()=>show('landing');
  if(!screens.some(s=>s.id===state.screen))state.screen='landing';
  render();
})();
