/**
 * 토스 앱인토스 제출용 이미지 에셋 생성
 * - 로고: 600x600 PNG
 * - 정방형 썸네일: 1000x1000 PNG
 * - 가로형 썸네일: 1932x828 PNG
 *
 * Usage: node scripts/generate-assets.mjs [--logo N]
 *   --logo N: 특정 로고 번호만 생성 (1~10)
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOGOS_DIR = join(ROOT, 'apps/miniapp/public/logos');
const OUT_DIR = join(ROOT, 'apps/miniapp/public/thumbnails');

mkdirSync(OUT_DIR, { recursive: true });

// Parse args
const logoArg = process.argv.indexOf('--logo');
const targetNum = logoArg !== -1 ? parseInt(process.argv[logoArg + 1]) : null;

// Find SVG files
const svgFiles = readdirSync(LOGOS_DIR)
  .filter(f => f.endsWith('.svg') && f.startsWith('logo-'))
  .sort();

if (svgFiles.length === 0) {
  console.error('No SVG files found in', LOGOS_DIR);
  process.exit(1);
}

console.log(`Found ${svgFiles.length} SVG logos\n`);

for (const svgFile of svgFiles) {
  const num = parseInt(svgFile.match(/logo-(\d+)/)?.[1]);
  if (targetNum && num !== targetNum) continue;

  const name = svgFile.replace('.svg', '');
  const svgBuffer = readFileSync(join(LOGOS_DIR, svgFile));

  console.log(`Processing ${svgFile}...`);

  // 1. 로고 600x600 PNG
  await sharp(svgBuffer, { density: 300 })
    .resize(600, 600)
    .png()
    .toFile(join(OUT_DIR, `${name}-600x600.png`));
  console.log(`  ✓ ${name}-600x600.png (로고)`);

  // 2. 정방형 썸네일 1000x1000 PNG
  // 로고를 중앙에 배치하고, 앱 이름을 아래에 텍스트로 추가
  // SVG로 래핑해서 생성
  const squareThumbSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
      <rect width="1000" height="1000" fill="#111111"/>
      <text x="500" y="620" text-anchor="middle" fill="white"
        font-family="'Apple SD Gothic Neo', 'Pretendard', -apple-system, sans-serif"
        font-size="72" font-weight="800">부동산 급매 레이더</text>
      <text x="500" y="700" text-anchor="middle" fill="#888888"
        font-family="'Apple SD Gothic Neo', 'Pretendard', -apple-system, sans-serif"
        font-size="32" font-weight="400">지역별 급매 분석 및 알람</text>
    </svg>`;

  // Create base with text, then composite logo on top
  const squareBase = await sharp(Buffer.from(squareThumbSvg))
    .resize(1000, 1000)
    .png()
    .toBuffer();

  const logoForSquare = await sharp(svgBuffer, { density: 300 })
    .resize(460, 460)
    .png()
    .toBuffer();

  await sharp(squareBase)
    .composite([{ input: logoForSquare, top: 80, left: 270 }])
    .png()
    .toFile(join(OUT_DIR, `${name}-1000x1000.png`));
  console.log(`  ✓ ${name}-1000x1000.png (정방형 썸네일)`);

  // 3. 가로형 썸네일 1932x828 PNG
  const wideThumbSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1932" height="828" viewBox="0 0 1932 828">
      <rect width="1932" height="828" fill="#111111"/>
      <text x="1200" y="340" text-anchor="middle" fill="white"
        font-family="'Apple SD Gothic Neo', 'Pretendard', -apple-system, sans-serif"
        font-size="68" font-weight="800">부동산 급매 레이더</text>
      <text x="1200" y="420" text-anchor="middle" fill="#aaaaaa"
        font-family="'Apple SD Gothic Neo', 'Pretendard', -apple-system, sans-serif"
        font-size="32" font-weight="400">지역별 급매 분석 및 알람</text>
      <rect x="1020" y="520" width="360" height="56" rx="28" fill="#3182F6"/>
      <text x="1200" y="556" text-anchor="middle" fill="white"
        font-family="'Apple SD Gothic Neo', 'Pretendard', -apple-system, sans-serif"
        font-size="24" font-weight="700">지금 확인하기</text>
    </svg>`;

  const wideBase = await sharp(Buffer.from(wideThumbSvg))
    .resize(1932, 828)
    .png()
    .toBuffer();

  const logoForWide = await sharp(svgBuffer, { density: 300 })
    .resize(560, 560)
    .png()
    .toBuffer();

  await sharp(wideBase)
    .composite([{ input: logoForWide, top: 134, left: 180 }])
    .png()
    .toFile(join(OUT_DIR, `${name}-1932x828.png`));
  console.log(`  ✓ ${name}-1932x828.png (가로형 썸네일)`);

  console.log('');
}

console.log('Done! Output directory:', OUT_DIR);
