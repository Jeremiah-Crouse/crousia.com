#!/usr/bin/env python3
# scripts/extract-black.py
# Usage: python scripts/extract-black.py [input.jpg] [output.png] [--color gold|purple|white]
import sys
import os
from PIL import Image, ImageOps

COLOR_MAP = {
    "white": (255, 255, 255),
    "gold": (255, 215, 0),
    "purple": (160, 32, 240),
}

def extract_black(input_path, output_path=None, color_name="white"):
    color_rgb = COLOR_MAP.get(color_name, (255, 255, 255))
    img = Image.open(input_path)
    
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Create a new image with transparency
    pixels = img.load()
    width, height = img.size
    
    # Find the bounding box of black/dark gray pixels
    black_pixels = []
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Check if pixel is dark enough (adjust threshold as needed)
            if r < 80 and g < 80 and b < 80 and a > 0:
                black_pixels.append((x, y))
                pixels[x, y] = (*color_rgb, 255)  # Make the chosen color
            else:
                pixels[x, y] = (0, 0, 0, 0)  # Make transparent
    
    if not black_pixels:
        print("No black pixels found!")
        return
    
    # Find bounding box
    xs = [p[0] for p in black_pixels]
    ys = [p[1] for p in black_pixels]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    # Crop to bounding box with small padding
    padding = 10
    left = max(0, min_x - padding)
    top = max(0, min_y - padding)
    right = min(width, max_x + padding)
    bottom = min(height, max_y + padding)
    
    cropped = img.crop((left, top, right, bottom))
    
    # Save
    if output_path is None:
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}-black.png"
    
    cropped.save(output_path, 'PNG')
    print(f"Saved {output_path}")

if __name__ == '__main__':
    input_path = "scripts/note.jpg"
    output_path = None
    color_name = "white"
    
    for arg in sys.argv[1:]:
        if arg in COLOR_MAP:
            color_name = arg
        elif not output_path:
            input_path = arg
        else:
            output_path = arg
    
    extract_black(input_path, output_path, color_name)