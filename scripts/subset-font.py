"""Pretendard 가변 글꼴을 unicode-range 조각으로 나눈다. 글리프·굵기 축은 그대로 두고 나누기만 한다.
실행: uvx --from 'fonttools[woff]' python scripts/subset-font.py
입력: packages/ui/src/fonts/pretendard.woff2 (원본, 그대로 둔다)
출력: packages/ui/src/fonts/subset/*.woff2, manifest.json, tokens.css 의 @font-face 블록(마커 사이)
"""
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "packages/ui/src/fonts/pretendard.woff2"
OUT = ROOT / "packages/ui/src/fonts/subset"
TOKENS = ROOT / "packages/ui/src/styles/tokens.css"
HANGUL = range(0xAC00, 0xD7A4)
REST_CHUNKS = 8

cmap = set(TTFont(SRC).getBestCmap())


def ks_x_1001(cp):
    # 파이썬 euc_kr 코덱은 확장 완성형(11,172자)까지 인코딩하므로 KS X 1001 한글 영역(0xB0A1-0xC8FE)만 센다.
    try:
        b = chr(cp).encode("euc_kr")
    except UnicodeEncodeError:
        return False
    return len(b) == 2 and 0xB0 <= b[0] <= 0xC8 and 0xA1 <= b[1] <= 0xFE


hangul = sorted(cp for cp in cmap if cp in HANGUL)
common = [cp for cp in hangul if ks_x_1001(cp)]
rest = [cp for cp in hangul if not ks_x_1001(cp)]
other = sorted(cp for cp in cmap if cp not in HANGUL)
# 첫 화면에 자주 쓰는 글자(ASCII·라틴-1·일반 문장부호·CJK 기호·한글 호환 자모·원·유로)만 따로 묶는다.
core = lambda cp: cp < 0x100 or 0x2000 <= cp < 0x2070 or 0x3000 <= cp < 0x3040 or 0x3130 <= cp < 0x3190 or cp in (0x20A9, 0x20AC)
size = -(-len(rest) // REST_CHUNKS)
groups = {
    "latin-basic": [cp for cp in other if core(cp)],
    "symbols": [cp for cp in other if not core(cp)],
    "hangul-common": common,
    **{f"hangul-rest-{i + 1}": rest[i * size : (i + 1) * size] for i in range(REST_CHUNKS)},
}
assert sum(len(v) for v in groups.values()) == len(cmap)


def ranges(cps):
    out, start, prev = [], cps[0], cps[0]
    for cp in cps[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        out.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(out)


OUT.mkdir(exist_ok=True)
for old in OUT.glob("*.woff2"):
    old.unlink()
manifest, faces = {}, []
for name, cps in groups.items():
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.notdef_outline = True
    opts.name_IDs = ["*"]
    font = subset.load_font(str(SRC), opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=cps)
    s.subset(font)
    subset.save_font(font, str(OUT / f"{name}.woff2"), opts)
    rng = ranges(cps)
    manifest[name] = {"count": len(cps), "unicodeRange": rng}
    faces.append(
        "@font-face {\n  font-family: 'Pretendard';\n"
        f"  src: url('../fonts/subset/{name}.woff2') format('woff2');\n"
        f"  unicode-range: {rng};\n"
        "  font-weight: 45 920;\n  font-style: normal;\n  font-display: swap;\n}\n"
    )
    print(f"{name}: {len(cps)}자 {(OUT / f'{name}.woff2').stat().st_size:,}B")

(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
css = TOKENS.read_text()
block = "/* pretendard-subset:start (scripts/subset-font.py 가 만든다) */\n" + "\n".join(faces) + "/* pretendard-subset:end */"
pat = re.compile(r"/\* pretendard-subset:start.*?pretendard-subset:end \*/|@font-face \{.*?\n\}", re.S)
TOKENS.write_text(pat.sub(lambda _: block, css, count=1))
