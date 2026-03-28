#!/bin/bash
# 로컬에서 업로드된 CSV를 estate_rt DB에 임포트
# Usage: bash scripts/rt-bulk/import-upload.sh

cd /home/ubuntu/estate_quick_sale
UPLOAD_DIR="scripts/rt-bulk/data/csv-upload"

if [ ! -d "$UPLOAD_DIR" ]; then
  echo "업로드 폴더 없음: $UPLOAD_DIR"
  exit 1
fi

echo "=== 업로드된 CSV 확인 ==="
for type_dir in "$UPLOAD_DIR"/*/; do
  type=$(basename "$type_dir")
  count=$(ls "$type_dir"/*.csv 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "  $type: ${count}개 파일"
  fi
done

echo ""
echo "=== 기존 data/csv로 이동 ==="
for type_dir in "$UPLOAD_DIR"/*/; do
  type=$(basename "$type_dir")
  target="scripts/rt-bulk/data/csv/$type"
  mkdir -p "$target"
  moved=0
  for f in "$type_dir"/*.csv; do
    [ -f "$f" ] || continue
    cp "$f" "$target/"
    moved=$((moved + 1))
  done
  [ "$moved" -gt 0 ] && echo "  $type: ${moved}개 이동"
done

echo ""
echo "=== DB 임포트 시작 ==="
node --env-file=.env scripts/rt-bulk/import-csv.mjs

echo ""
echo "=== 임포트 완료. 업로드 폴더 정리 ==="
rm -rf "$UPLOAD_DIR"
echo "done"
