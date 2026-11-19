import sys, json
from PIL import Image, ImageChops
pairs = [tuple(p.split('=')) for p in sys.argv[1:]]
out = []
for a, b in pairs:
    A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')
    r = {'a': a.split('/')[-1], 'b': b.split('/')[-1], 'sizeA': A.size, 'sizeB': B.size}
    if A.size == B.size:
        d = ImageChops.difference(A, B)
        bbox = d.getbbox()
        px = sum(1 for p in d.getdata() if p != (0, 0, 0))
        r.update(diffPixels=px, bbox=bbox)
        if bbox:
            d.point(lambda v: 255 if v else 0).save(b.replace('.png', '-diff.png').replace('/web-ui-', '/critic-behavior-r1-diff-'))
    out.append(r)
print(json.dumps(out, ensure_ascii=False))
