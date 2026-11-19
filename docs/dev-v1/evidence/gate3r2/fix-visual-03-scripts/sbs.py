import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
d = ImageChops.difference(a, b).point(lambda v: 255 if v > 8 else 0)
W, H = a.size
out = Image.new('RGB', (W * 3, H), 'white')
out.paste(a, (0, 0)); out.paste(b, (W, 0)); out.paste(d, (W * 2, 0))
out = out.resize((W * 3 // 2, H // 2))
out.save(sys.argv[3])
