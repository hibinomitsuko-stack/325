#!/bin/bash
# 使い方: ./md2txt.sh <記事フォルダ名>
# 例:     ./md2txt.sh shusei-zero-41ken
A="$HOME/note-kit/note-draft/articles/$1/article.md"
[ -f "$A" ] || { echo "見つかりません: $A"; exit 1; }
OUT="$HOME/Desktop/$1.txt"
sed -e '1,/^---$/d' \
    -e 's/^### /  ◇ /' \
    -e 's/^## /■ /' \
    -e 's/^> /  ▶ /' \
    -e 's/\*\*//g' \
    -e 's|^!\[\(.*\)\](.*fig\([0-9]\).*)|［図\2］\1|' \
    "$A" > "$OUT"
echo "作りました: $OUT"
open -a TextEdit "$OUT"
