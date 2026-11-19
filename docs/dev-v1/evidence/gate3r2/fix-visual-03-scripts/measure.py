# 03 화면 실측(CSS px): 드래프트(852폭)와 실행 캡처(390 css 폭) 공통
import sys
from PIL import Image
def measure(path):
    d = Image.open(path).convert('RGB')
    W, H = d.size; s = 390 / W; px = d.load(); k = 1 / s
    P = lambda v: int(v * k)
    dark = lambda c: sum(c) < 450
    orange = lambda c: c[0] > 230 and 90 < c[1] < 190 and c[2] < 120
    yellow = lambda c: c[0] > 235 and c[1] > 200 and c[2] < 175
    def rows(pred, x0, x1, y0, y1, gap=3):
        ys = [y for y in range(P(y0), P(y1)) if any(pred(px[x, y]) for x in range(P(x0), P(x1), 2))]
        if not ys: return []
        groups, g = [], [ys[0]]
        for y in ys[1:]:
            if y - g[-1] > gap * k / 2.18: groups.append(g); g = [y]
            else: g.append(y)
        groups.append(g)
        return [(round(g[0]*s,1), round(g[-1]*s,1)) for g in groups]
    def bbox(pred, x0, y0, x1, y1):
        xs, ys = [], []
        for y in range(P(y0), P(y1)):
            for x in range(P(x0), min(P(x1), W)):
                if pred(px[x, y]): xs.append(x); ys.append(y)
        return [round(v * s, 1) for v in (min(xs), min(ys), max(xs), max(ys))] if xs else None
    nav = rows(dark, 130, 260, 0, 100)[0]
    out = {'navTitle': nav}
    out['hero'] = rows(dark, 20, 215, nav[1] + 60, nav[1] + 230)
    sub = out['hero'][-1]
    out['subRight'] = max(round(x * s, 1) for y in range(P(sub[0]), P(sub[1])) for x in range(0, P(250)) if dark(px[x, y]))
    out['mascotBody'] = bbox(yellow, 238, nav[1] + 60, 390, nav[1] + 260)
    out['burst'] = bbox(orange, 180, nav[1] + 80, 250, nav[1] + 150)
    # 카드: x=330 열 흰색 구간
    col = [px[P(330), y] for y in range(P(nav[1] + 230), P(nav[1] + 620))]
    runs, start = [], None
    for i, c in enumerate(col):
        w = min(c) >= 250
        if w and start is None: start = i
        if not w and start is not None: runs.append((start, i)); start = None
    y0 = P(nav[1] + 230)
    cards = [(round((a + y0) * s, 1), round((b + y0) * s, 1)) for a, b in runs if (b - a) * s > 40]
    out['cards'] = [(a, b, round(b - a, 1)) for a, b in cards]
    out['gaps'] = [round(cards[i + 1][0] - cards[i][1], 1) for i in range(len(cards) - 1)]
    out['cardText'] = [rows(lambda c: dark(c) or orange(c), 118, 300, a + 2, b - 2) for a, b in cards]
    out['avatarColors'] = [px[P(36), P((a + b) / 2)] for a, b in cards]
    out['avatarX'] = []
    for a, b in cards:
        y = P((a + b) / 2)
        nw = [x for x in range(P(18), P(160)) if min(px[x, y]) < 248]
        out['avatarX'].append((round(nw[0]*s,1), round(nw[-1]*s,1)) if nw else None)
    out['count'] = rows(dark, 20, 120, nav[1] + 210, cards[0][0] - 2)
    # 상대 위치(네비 제목 아래 기준)
    base = nav[1]
    out['rel'] = {
        'heroTitleTop': round(out['hero'][0][0] - base, 1), 'subTop': round(sub[0] - base, 1),
        'mascotTop': round(out['mascotBody'][1] - base, 1) if out['mascotBody'] else None,
        'mascotBottom': round(out['mascotBody'][3] - base, 1) if out['mascotBody'] else None,
        'countTop': round(out['count'][0][0] - base, 1) if out['count'] else None,
        'firstCardTop': round(cards[0][0] - base, 1), 'lastCardBottom': round(cards[-1][1] - base, 1),
        'mascotLeft_minus_subRight': round(out['mascotBody'][0] - out['subRight'], 1) if out['mascotBody'] else None,
    }
    return out
import json
for p in sys.argv[1:]:
    print(p.split('/')[-1]); print(json.dumps(measure(p), ensure_ascii=False))
