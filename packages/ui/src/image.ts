// 브라우저 이미지 도우미 (PoC persona 화면에서 옮김). 업로드 전에 줄이고, 저장 전에 작게 만든다.

/** 긴 변을 max 로 줄여 다시 인코딩한다. 기본은 JPEG (Vercel 요청 4.5MB 제한 대비). */
export async function shrinkImage(file: Blob, max: number, type = 'image/jpeg', quality = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 줄이지 못했어요.'))), type, quality),
  );
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
