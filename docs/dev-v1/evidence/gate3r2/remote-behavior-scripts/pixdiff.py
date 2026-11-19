import sys, json
from PIL import Image, ImageChops
EV = '/Users/jeongyounglee/work/repo/mindme/docs/dev-v1/evidence/gate3r2'
out = []
for vp in ['1440', '390']:
    for s in ['01', '02', '04']:
        a = f'{EV}/remote-behavior-parity-{vp}-{s}-local.png'
        b = f'{EV}/remote-behavior-parity-{vp}-{s}-remote.png'
        A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')
        r = {'pair': f'{vp}-{s}', 'size': A.size, 'sameSize': A.size == B.size}
        if A.size == B.size:
            d = ImageChops.difference(A, B)
            bbox = d.getbbox()
            data = list(d.getdata())
            px = sum(1 for p in data if p != (0, 0, 0))
            r.update(diffPixels=px, totalPixels=A.size[0]*A.size[1], ratio=round(px/(A.size[0]*A.size[1]), 6), bbox=bbox, maxChannelDiff=max((max(p) for p in data), default=0), over16=sum(1 for p in data if max(p) > 16))
            if bbox:
                d.point(lambda v: 255 if v else 0).save(f'{EV}/remote-behavior-parity-{vp}-{s}-diff.png')
        out.append(r)
json.dump(out, open(f'{EV}/remote-behavior-parity.json', 'w'), indent=1)
print(json.dumps(out))
