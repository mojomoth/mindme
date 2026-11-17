// 네이티브 기능 경계. 웹 구현만 둔다. Capacitor 포팅 시 같은 인터페이스로 구현을 갈아 끼운다.
export interface NativeAdapter {
  /** 파일 선택(TXT·사진). 취소하면 null */
  pickFile(accept: string): Promise<File | null>;
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  };
}

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const webNative: NativeAdapter = {
  pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
  storage: {
    get: (key) => safe(() => localStorage.getItem(key), null),
    set: (key, value) => safe(() => localStorage.setItem(key, value), undefined),
    remove: (key) => safe(() => localStorage.removeItem(key), undefined),
  },
};
