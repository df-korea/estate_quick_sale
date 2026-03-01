/** SVG short name → DB city name (API가 반환하는 실제 값) */
const SVG_TO_DB: Record<string, string> = {
  '서울': '서울시',
  '부산': '부산시',
  '대구': '대구시',
  '인천': '인천시',
  '광주': '광주시',
  '대전': '대전시',
  '울산': '울산시',
  '세종': '세종시',
  '경기': '경기도',
  '강원': '강원도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주도',
};

/** DB city name → SVG short name */
const DB_TO_SVG: Record<string, string> = {};
for (const [svg, db] of Object.entries(SVG_TO_DB)) {
  DB_TO_SVG[db] = svg;
}

/** 시도 코드 → DB city name */
const CODE_TO_DB: Record<string, string> = {
  '11': '서울시',
  '26': '부산시',
  '27': '대구시',
  '28': '인천시',
  '29': '광주시',
  '30': '대전시',
  '31': '울산시',
  '36': '세종시',
  '41': '경기도',
  '42': '강원도',
  '43': '충청북도',
  '44': '충청남도',
  '45': '전북도',
  '46': '전라남도',
  '47': '경상북도',
  '48': '경상남도',
  '50': '제주도',
};

/** SVG short name → DB city name (API용) */
export function shortNameToFull(shortName: string): string {
  return SVG_TO_DB[shortName] ?? shortName;
}

/** DB city name → SVG short name (breadcrumb용) */
export function fullNameToShort(dbName: string): string {
  return DB_TO_SVG[dbName] ?? dbName;
}

/** 시도 코드 → DB city name */
export function codeToSido(code: string): string {
  return CODE_TO_DB[code] ?? code;
}

/** DB city name → 시도 코드 */
export function sidoToCode(name: string): string | undefined {
  for (const [code, dbName] of Object.entries(CODE_TO_DB)) {
    if (dbName === name) return code;
  }
  return undefined;
}

/** 급매 비율에 따른 히트맵 색상 */
export function bargainRatioColor(ratio: number | string): string {
  ratio = Number(ratio);
  if (ratio >= 15) return '#e02020';
  if (ratio >= 10) return '#f04452';
  if (ratio >= 7) return '#ff6666';
  if (ratio >= 5) return '#ffa726';
  if (ratio >= 3) return '#ffc107';
  if (ratio >= 1) return '#90c2ff';
  return '#e5e8eb';
}
