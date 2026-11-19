"""Pretendard 분할 무결성: 원본 cmap 이 조각 cmap 합과 같은지, tokens.css unicode-range 와 조각 cmap 이 맞는지, 글리프 윤곽이 같은지."""
import json
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path("/Users/jeongyounglee/work/repo/mindme")
FONTS = ROOT / "packages/ui/src/fonts"
css = (ROOT / "packages/ui/src/styles/tokens.css").read_text()

orig = TTFont(FONTS / "pretendard.woff2")
ocmap = orig.getBestCmap()
out = {"origGlyphs": len(ocmap), "origAxes": [(a.axisTag, a.minValue, a.maxValue) for a in orig["fvar"].axes] if "fvar" in orig else None}


def parse_range(s):
    cps = set()
    for part in s.split(","):
        part = part.strip().upper().replace("U+", "")
        if "-" in part:
            lo, hi = part.split("-")
            cps.update(range(int(lo, 16), int(hi, 16) + 1))
        elif part:
            cps.add(int(part, 16))
    return cps


faces = re.findall(r"src: url\('\.\./fonts/subset/([^']+)'\) format\('woff2'\);\s*unicode-range: ([^;]+);", css)
out["faces"] = len(faces)
declared_all = {}
union = set()
problems = []
per = {}
glyph_diff = []
from fontTools.pens.recordingPen import RecordingPen

SAMPLE = "가나다똠햏힣A가뷁쀍쓩!?.,₩"
for fname, rng in faces:
    f = TTFont(FONTS / "subset" / fname)
    cmap = f.getBestCmap()
    declared = parse_range(rng)
    missing_in_file = sorted(cp for cp in declared if cp in ocmap and cp not in cmap)
    undeclared = sorted(cp for cp in cmap if cp not in declared)
    for cp in declared:
        if cp in declared_all:
            problems.append(f"U+{cp:04X} 두 조각에 선언: {declared_all[cp]}, {fname}")
        declared_all[cp] = fname
    union |= set(cmap)
    per[fname] = {
        "glyphs": len(cmap),
        "declared": len(declared),
        "declaredButMissing": len(missing_in_file),
        "inFileNotDeclared": len(undeclared),
        "axes": [(a.axisTag, a.minValue, a.maxValue) for a in f["fvar"].axes] if "fvar" in f else None,
        "hasGvar": "gvar" in f,
        "hasGSUB": "GSUB" in f,
        "hasGPOS": "GPOS" in f,
    }
    # 표본 글자 윤곽 비교 (기본 위치)
    gs_o = orig.getGlyphSet()
    gs_s = f.getGlyphSet()
    for ch in SAMPLE:
        cp = ord(ch)
        if cp in cmap:
            po, ps = RecordingPen(), RecordingPen()
            gs_o[ocmap[cp]].draw(po)
            gs_s[cmap[cp]].draw(ps)
            same = po.value == ps.value and gs_o[ocmap[cp]].width == gs_s[cmap[cp]].width
            glyph_diff.append({"char": ch, "file": fname, "sameOutline": same})

out["perFace"] = per
out["origNotInAnySubset"] = len(set(ocmap) - union)
out["origNotDeclared"] = len(set(ocmap) - set(declared_all))
out["origNotDeclaredSample"] = [f"U+{cp:04X}" for cp in sorted(set(ocmap) - set(declared_all))[:20]]
out["overlapProblems"] = problems[:10]
out["glyphSample"] = glyph_diff
out["rareChars"] = {ch: declared_all.get(ord(ch)) for ch in "똠햏뷁쀍"}
out["pass"] = (
    out["origNotInAnySubset"] == 0
    and out["origNotDeclared"] == 0
    and not problems
    and all(v["declaredButMissing"] == 0 for v in per.values())
    and all(g["sameOutline"] for g in glyph_diff)
)
Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in out.items() if k not in ("perFace", "glyphSample")}, ensure_ascii=False))
print("glyphSample all same:", all(g["sameOutline"] for g in glyph_diff), len(glyph_diff))
for k, v in per.items():
    print(k, v)
