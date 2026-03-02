/** 원 단위 → "3억 5,000만" / "8,500만" */
export function formatWon(won: number | null | undefined): string {
  if (won == null) return '-';
  const num = Number(won);
  if (num >= 100_000_000) {
    const eok = Math.floor(num / 100_000_000);
    const remainder = Math.round((num % 100_000_000) / 10_000);
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${Math.round(num / 10_000).toLocaleString()}만`;
}

/** 만원 단위 → "3억 5,000만" (실거래가용) */
export function formatPrice(manwon: number | null | undefined): string {
  if (manwon == null) return '-';
  return formatWon(Number(manwon) * 10_000);
}

/** ㎡ → 평 */
export function toPyeong(sqm: number): number {
  return Math.round(sqm / 3.3058);
}

/** "84.82㎡ (25평)" */
export function formatArea(sqm: number | null | undefined): string {
  if (sqm == null) return '-';
  return `${sqm}㎡ (${toPyeong(sqm)}평)`;
}

/** 등록일로부터 경과일 */
export function daysOnMarket(firstSeenAt: string | null | undefined): number {
  if (!firstSeenAt) return 0;
  return Math.floor((Date.now() - new Date(firstSeenAt).getTime()) / 86_400_000);
}

/** "3일 전" / "오늘" 등 */
export function relativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

/** 거래유형별 가격 표시 (매매: deal_price, 전세: warranty_price, 월세: 보증금/월세) */
export function formatTradePrice(
  tradeType: string,
  dealPrice: number | null | undefined,
  warrantyPrice: number | null | undefined,
  rentPrice: number | null | undefined,
): string {
  if (tradeType === 'B2' || tradeType === 'B3') {
    const w = formatWon(warrantyPrice);
    const r = rentPrice ? Math.round(Number(rentPrice) / 10_000).toLocaleString() : '0';
    return `${w}/${r}만`;
  }
  if (tradeType === 'B1') {
    return formatWon(warrantyPrice);
  }
  return formatWon(dealPrice);
}

/** 거래유형 코드 → 라벨 */
export function tradeTypeLabel(code: string): string {
  switch (code) {
    case 'A1': return '매매';
    case 'B1': return '전세';
    case 'B2': return '월세';
    default: return code;
  }
}

/** 시도명 축약 (서울특별시→서울, 경상북도→경북) */
const CITY_ABBREV: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
  '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종',
  '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남',
  '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
  '제주특별자치도': '제주',
  // DB short forms
  '서울시': '서울', '부산시': '부산', '대구시': '대구', '인천시': '인천',
  '광주시': '광주', '대전시': '대전', '울산시': '울산', '세종시': '세종',
  '강원도': '강원', '전북도': '전북', '충청북': '충북', '충청남': '충남',
  '제주도': '제주',
};
export function abbreviateCity(city: string | null | undefined): string {
  if (!city) return '';
  return CITY_ABBREV[city] ?? city;
}

/** 변동률 포맷 (e.g. "+3.2%" / "-5.1%") */
export function formatPercent(pct: number | string | null | undefined): string {
  if (pct == null) return '-';
  const num = Number(pct);
  if (isNaN(num)) return '-';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}
