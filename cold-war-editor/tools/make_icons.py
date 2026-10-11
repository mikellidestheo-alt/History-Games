"""Generate the app icons (original pixel art) for cold-war-editor/icons/.
Run from the repository root:  python3 cold-war-editor/tools/make_icons.py
Needs Pillow. The icons are committed, so teachers never need to run this."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')

# 32x32 design: a manuscript page with a red REJECT-style stamp block and a green tick.
ART = [
    "................................",
    "................................",
    "................................",
    "........kkkkkkkkkkkkkkkk........",
    "........kpppppppppppppkk........",
    "........kpppppppppppppkpk.......",
    "........kpllllllllllppkppk......",
    "........kpppppppppppppkkkkk.....",
    "........kplllllllllllllllpk.....",
    "........kpppppppppppppppppk.....",
    "........kplllllllllllllllpk.....",
    "........kpppppppppppppppppk.....",
    "........kplllllllllllllppppk....",
    "........kpppppppppppppppppk.....",
    "........kprrrrrrrrrrrrrrrpk.....",
    "........kprrrrrrrrrrrrrrrpk.....",
    "........kprrrrrrrrrrrrwwrpk.....",
    "........kprrrrrrrrrrrwwrrpk.....",
    "........kprrrwwrrrrrwwrrrpk.....",
    "........kprrrrwwrrrwwrrrrpk.....",
    "........kprrrrrwwrwwrrrrrpk.....",
    "........kprrrrrrwwwrrrrrrpk.....",
    "........kprrrrrrrrrrrrrrrpk.....",
    "........kpppppppppppppppppk.....",
    "........kplllllllllllllllpk.....",
    "........kpppppppppppppppppk.....",
    "........kkkkkkkkkkkkkkkkkkk.....",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
]
PAL = {
    'k': (29, 27, 23, 255), 'p': (246, 241, 227, 255), 'l': (150, 140, 120, 255),
    'r': (176, 52, 42, 255), 'w': (246, 241, 227, 255), '.': None,
}
BG = (36, 49, 61, 255)


def render(size, pad_ratio=0.0):
    grid = 32
    img = Image.new('RGBA', (size, size), BG)
    inner = int(size * (1 - 2 * pad_ratio))
    cell = inner / grid
    off = (size - inner) / 2
    px = img.load()
    for y, row in enumerate(ART):
        for x, ch in enumerate(row):
            col = PAL.get(ch)
            if not col:
                continue
            x0, y0 = int(off + x * cell), int(off + y * cell)
            x1, y1 = int(off + (x + 1) * cell), int(off + (y + 1) * cell)
            for yy in range(y0, y1):
                for xx in range(x0, x1):
                    px[xx, yy] = col
    return img


def svg():
    rects = []
    for y, row in enumerate(ART):
        for x, ch in enumerate(row):
            col = PAL.get(ch)
            if col:
                rects.append('<rect x="%d" y="%d" width="1" height="1" fill="#%02x%02x%02x"/>' % (x, y, *col[:3]))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">'
            '<rect width="32" height="32" fill="#24313d"/>' + ''.join(rects) + '</svg>\n')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    render(192).save(os.path.join(OUT, 'icon-192.png'))
    render(512).save(os.path.join(OUT, 'icon-512.png'))
    render(512, 0.1).save(os.path.join(OUT, 'icon-maskable-512.png'))
    render(180).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    with open(os.path.join(OUT, 'icon.svg'), 'w') as f:
        f.write(svg())
    print('icons written to', os.path.normpath(OUT))
