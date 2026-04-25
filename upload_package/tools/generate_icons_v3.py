import argparse
import os
import sys
# import numpy as np # defringe not used
from PIL import Image

def hex_to_rgba(hex_color: str) -> tuple:
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

def generate(master_path: str, outdir: str, bg_color: tuple):
    if not os.path.exists(master_path):
        print(f"Error: マスター画像が見つかりません: {master_path}")
        sys.exit(1)

    os.makedirs(outdir, exist_ok=True)

    print(f"マスター: {master_path}")
    print(f"出力先:   {outdir}")
    print(f"背景色:   #{bg_color[0]:02x}{bg_color[1]:02x}{bg_color[2]:02x}")

    src = Image.open(master_path).convert('RGBA')

    generated = []
    suffix = "-v3"

    # --- 1. Standard (any purpose) ---
    for size in [192, 512]:
        out = os.path.join(outdir, f'icon-{size}{suffix}.png')
        src.resize((size, size), Image.LANCZOS).save(out)
        generated.append(out)

    # --- 2. Maskable (80% safe zone + background) ---
    for size in [192, 512]:
        out = os.path.join(outdir, f'icon-{size}-maskable{suffix}.png')
        canvas = Image.new('RGBA', (size, size), bg_color)
        logo_w = int(size * 0.8)
        logo = src.resize((logo_w, logo_w), Image.LANCZOS)
        offset = (size - logo_w) // 2
        canvas.paste(logo, (offset, offset), logo)
        canvas.save(out)
        generated.append(out)

    # --- 3. Apple Touch Icon (180x180) ---
    out = os.path.join(outdir, f'apple-touch-icon{suffix}.png')
    src.resize((180, 180), Image.LANCZOS).save(out)
    generated.append(out)

    # --- 4. Favicon (32x32) ---
    out = os.path.join(outdir, f'favicon-32{suffix}.png')
    src.resize((32, 32), Image.LANCZOS).save(out)
    generated.append(out)
    
    # (Optional) Original Favicon Update (to be safe)
    # out = os.path.join(outdir, 'favicon.ico')
    # src.resize((32, 32), Image.LANCZOS).save(out)


    print(f"\n生成完了: {len(generated)}ファイル")
    for f in generated:
        print(f"  ✅ {f}")

def main():
    parser = argparse.ArgumentParser(description='PWA Icon Generator v3')
    parser.add_argument('master', help='Master image path')
    parser.add_argument('--outdir', '-o', default='.', help='Output directory')
    parser.add_argument('--bg', default='#020405', help='Background color hex')

    args = parser.parse_args()
    bg = hex_to_rgba(args.bg)
    generate(args.master, args.outdir, bg)

if __name__ == '__main__':
    main()
