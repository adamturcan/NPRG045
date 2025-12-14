#!/bin/bash
# Script to download Noto Sans TTF fonts

cd "$(dirname "$0")/../public/fonts" || exit 1

echo "Downloading Noto Sans fonts..."

# Download from a reliable source - using raw.githubusercontent.com
curl -L "https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Regular.ttf" -o NotoSans-Regular.ttf
curl -L "https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans-Bold.ttf" -o NotoSans-Bold.ttf

# Verify files
if file NotoSans-Regular.ttf | grep -q "TrueType\|OpenType"; then
    echo "✓ NotoSans-Regular.ttf downloaded successfully"
else
    echo "✗ NotoSans-Regular.ttf download failed - file is not a valid font"
    echo "Please download manually from: https://fonts.google.com/noto/specimen/Noto+Sans"
fi

if file NotoSans-Bold.ttf | grep -q "TrueType\|OpenType"; then
    echo "✓ NotoSans-Bold.ttf downloaded successfully"
else
    echo "✗ NotoSans-Bold.ttf download failed - file is not a valid font"
    echo "Please download manually from: https://fonts.google.com/noto/specimen/Noto+Sans"
fi

