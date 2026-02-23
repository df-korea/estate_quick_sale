#!/usr/bin/env node
import { pool } from './db.mjs';

const API_KEY = process.env.KAKAO_REST_API_KEY;
if (!API_KEY) { console.log('KAKAO_REST_API_KEY 없음'); process.exit(1); }

const { rows } = await pool.query(`
  SELECT c.id, c.complex_name, c.property_type, cr.sgg_name, cr.sido_name
  FROM complexes c
  JOIN complex_regions cr ON cr.complex_id = c.id
  WHERE c.is_active = true AND c.lat IS NULL
  ORDER BY random()
  LIMIT 50
`);

let ok = 0, miss = 0;
const missed = [];
for (const r of rows) {
  const query = r.sgg_name + ' ' + r.complex_name;
  const suffix = r.property_type === 'OPST' ? '오피스텔' : '아파트';

  // 시도1: 카카오 키워드 검색
  const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(query) + '&size=1';
  const res = await fetch(url, { headers: { Authorization: 'KakaoAK ' + API_KEY } });
  const data = await res.json();
  const doc = data.documents?.[0];
  if (doc && doc.category_name?.includes('주거시설')) {
    ok++;
  } else {
    // 시도2: "아파트"/"오피스텔" 붙여서 재시도
    const url2 = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(query + suffix) + '&size=1';
    const res2 = await fetch(url2, { headers: { Authorization: 'KakaoAK ' + API_KEY } });
    const data2 = await res2.json();
    const doc2 = data2.documents?.[0];
    if (doc2 && doc2.category_name?.includes('주거시설')) {
      ok++;
    } else {
      missed.push(`${r.sgg_name} ${r.complex_name} (${r.property_type})`);
      miss++;
    }
  }
  await new Promise(r => setTimeout(r, 100));
}

console.log(`\n결과: ${ok}/${ok+miss} 성공 (${Math.round(ok/(ok+miss)*100)}%)`);
if (missed.length > 0) {
  console.log(`\nMISS 목록:`);
  missed.forEach(m => console.log(`  - ${m}`));
}
await pool.end();
