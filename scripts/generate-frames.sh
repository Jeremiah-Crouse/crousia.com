#!/bin/bash
# Generate animated gold text frames

FONT="/System/Library/Fonts/Supplemental/Cormorant Garamond Bold.ttf"
OUTPUT_DIR="public/frames"
mkdir -p "$OUTPUT_DIR"

# Generate 12 frames for animation
for i in $(seq 0 11); do
    angle=$((i * 30))
    
    convert -size 100x50 xc:transparent \
        -font "$FONT" \
        -fill "rgba(201, 162, 39, 1)" \
        -draw "gravity center text 0,0 'GOLD'" \
        -modulate 100,100,$((80 + (i * 3))) \
        -blur 0x$((i % 3)) \
        "$OUTPUT_DIR/frame-$(printf '%02d' $i).png"
done

echo "Generated 12 frames in $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR/"
