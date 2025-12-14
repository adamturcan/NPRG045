#!/bin/bash
# Script to copy Noto Sans Regular and Bold fonts to the correct location
# Usage: ./scripts/copyNotoSansFonts.sh <path-to-extracted-font-folder>

FONTS_DIR="$(dirname "$0")/../public/fonts"
SOURCE_DIR="$1"

if [ -z "$SOURCE_DIR" ]; then
    echo "Usage: $0 <path-to-extracted-noto-sans-folder>"
    echo ""
    echo "Example: $0 ~/Downloads/noto-sans"
    echo ""
    echo "Looking for fonts in common locations..."
    
    # Try to find fonts in Downloads
    DOWNLOADS_FONT=$(find ~/Downloads -type d -name "*noto*" -o -name "*Noto*" 2>/dev/null | head -1)
    if [ -n "$DOWNLOADS_FONT" ]; then
        echo "Found potential font folder: $DOWNLOADS_FONT"
        SOURCE_DIR="$DOWNLOADS_FONT"
    else
        echo "Please provide the path to the extracted Noto Sans font folder"
        exit 1
    fi
fi

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    exit 1
fi

echo "Looking for Noto Sans font files in: $SOURCE_DIR"

# Try different naming patterns
REGULAR=$(find "$SOURCE_DIR" -type f \( -iname "*notosans*regular*.ttf" -o -iname "*notosans-regular.ttf" -o -iname "*notosans_regular.ttf" -o -iname "notosans.ttf" \) 2>/dev/null | head -1)
BOLD=$(find "$SOURCE_DIR" -type f \( -iname "*notosans*bold*.ttf" -o -iname "*notosans-bold.ttf" -o -iname "*notosans_bold.ttf" \) 2>/dev/null | head -1)

# Also check static subdirectory
if [ -z "$REGULAR" ] && [ -d "$SOURCE_DIR/static" ]; then
    REGULAR=$(find "$SOURCE_DIR/static" -type f \( -iname "*notosans*regular*.ttf" -o -iname "*notosans-regular.ttf" \) 2>/dev/null | head -1)
fi

if [ -z "$BOLD" ] && [ -d "$SOURCE_DIR/static" ]; then
    BOLD=$(find "$SOURCE_DIR/static" -type f \( -iname "*notosans*bold*.ttf" -o -iname "*notosans-bold.ttf" \) 2>/dev/null | head -1)
fi

if [ -z "$REGULAR" ]; then
    echo "Error: Could not find NotoSans Regular font file"
    echo "Searched in: $SOURCE_DIR"
    echo ""
    echo "Available TTF files:"
    find "$SOURCE_DIR" -name "*.ttf" -type f | head -10
    exit 1
fi

if [ -z "$BOLD" ]; then
    echo "Error: Could not find NotoSans Bold font file"
    echo "Searched in: $SOURCE_DIR"
    echo ""
    echo "Available TTF files:"
    find "$SOURCE_DIR" -name "*.ttf" -type f | head -10
    exit 1
fi

echo "Found Regular: $REGULAR"
echo "Found Bold: $BOLD"

# Verify they're actual font files
if ! file "$REGULAR" | grep -q "TrueType\|OpenType\|Font"; then
    echo "Warning: $REGULAR doesn't appear to be a valid font file"
    file "$REGULAR"
fi

if ! file "$BOLD" | grep -q "TrueType\|OpenType\|Font"; then
    echo "Warning: $BOLD doesn't appear to be a valid font file"
    file "$BOLD"
fi

# Copy files
echo ""
echo "Copying fonts to $FONTS_DIR..."
cp "$REGULAR" "$FONTS_DIR/NotoSans-Regular.ttf"
cp "$BOLD" "$FONTS_DIR/NotoSans-Bold.ttf"

echo "✓ Fonts copied successfully!"
echo ""
echo "Verifying..."
file "$FONTS_DIR/NotoSans-Regular.ttf"
file "$FONTS_DIR/NotoSans-Bold.ttf"

