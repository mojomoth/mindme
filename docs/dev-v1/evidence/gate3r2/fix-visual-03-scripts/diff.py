import sys, json
from PIL import Image, ImageChops
ev = sys.argv[1]
out = []
for vp in ('390', '360', '1440'):
    for scr in ('02-create', '03-list', '04-modal', '05-chat'):
        a = Image.open(f'{ev}/fix-visual-03-before-{vp}-{scr}.png').convert('RGB')
        b = Image.open(f'{ev}/fix-visual-03-after-{vp}-{scr}.png').convert('RGB')
        r = {'vp': vp, 'screen': scr, 'size': a.size == b.size}
        if a.size == b.size:
            d = ImageChops.difference(a, b)
            bbox = d.getbbox()
            r['diffPixels'] = sum(1 for p in d.getdata() if max(p) > 8)
            r['bbox'] = bbox
            if scr == '04-modal' and bbox:
                # 모달 시트(밝은 흰 영역) 안에서 바뀐 픽셀: 시트 위치 = 화면 아래쪽 흰 영역
                W, H = a.size
                px = a.load()
                ys = [y for y in range(H) if all(min(px[x, y]) >= 250 for x in range(int(W*0.45), int(W*0.55)))]
                if ys:
                    top = ys[0]
                    dd = d.crop((0, top, W, H))
                    r['modalTopY'] = top
                    r['diffInModal'] = sum(1 for p in dd.getdata() if max(p) > 8)
        out.append(r)
print(json.dumps(out, ensure_ascii=False, indent=0))
