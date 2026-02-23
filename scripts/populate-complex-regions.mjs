#!/usr/bin/env node
/**
 * Populates complex_regions table by matching complexes with real_transactions.
 * Matches complex_name → apt_nm to extract sgg_cd, then looks up sido/sgg names.
 *
 * Usage: node --env-file=.env scripts/populate-complex-regions.mjs
 */

import { pool } from './db.mjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sggCodes = JSON.parse(readFileSync(join(__dirname, 'data', 'sgg-codes.json'), 'utf-8'));

// Build lookup: code → { name, sido, localName }
const sggMap = new Map();
for (const item of sggCodes) {
  const localName = item.name.replace(`${item.sido} `, '') || item.name;
  sggMap.set(item.code, { ...item, localName });
}

async function main() {
  console.log('=== Complex Regions Population ===\n');

  // Step 1: Create table
  console.log('1. Creating complex_regions table...');
  await pool.query(`
    DROP TABLE IF EXISTS complex_districts CASCADE;
    DROP TABLE IF EXISTS complex_regions CASCADE;
    CREATE TABLE complex_regions (
      complex_id BIGINT PRIMARY KEY REFERENCES complexes(id),
      sgg_cd TEXT NOT NULL,
      sido_code TEXT NOT NULL,
      sido_name TEXT NOT NULL,
      sgg_name TEXT NOT NULL
    );
    CREATE INDEX idx_cr_sido ON complex_regions(sido_code);
    CREATE INDEX idx_cr_sgg ON complex_regions(sgg_cd);
  `);
  console.log('   Done.\n');

  // Step 2: Get distinct apt_nm → sgg_cd from real_transactions
  console.log('2. Fetching apt_nm → sgg_cd mappings from real_transactions...');
  const { rows: txMappings } = await pool.query(`
    SELECT apt_nm, sgg_cd, count(*)::int AS cnt
    FROM real_transactions
    WHERE apt_nm IS NOT NULL AND sgg_cd IS NOT NULL
    GROUP BY apt_nm, sgg_cd
    ORDER BY count(*) DESC
  `);
  console.log(`   Found ${txMappings.length} distinct apt_nm/sgg_cd pairs.\n`);

  // Build apt_nm → sgg_cd map (take the most frequent sgg_cd for each name)
  const aptNameToSgg = new Map();
  for (const row of txMappings) {
    const key = row.apt_nm.trim();
    if (!aptNameToSgg.has(key)) {
      aptNameToSgg.set(key, row.sgg_cd);
    }
  }

  // Step 3: Get all complexes
  console.log('3. Fetching complexes...');
  const { rows: complexes } = await pool.query(`
    SELECT id, complex_name FROM complexes WHERE is_active = true
  `);
  console.log(`   Found ${complexes.length} active complexes.\n`);

  // Step 4: Match complexes to regions
  console.log('4. Matching complexes to regions...');
  let matched = 0;
  let unmatched = 0;
  const inserts = [];

  for (const complex of complexes) {
    const name = complex.complex_name?.trim();
    if (!name) { unmatched++; continue; }

    const sggCd = aptNameToSgg.get(name);
    if (sggCd) {
      const sggInfo = sggMap.get(sggCd);
      if (sggInfo) {
        const sidoCode = sggCd.substring(0, 2);
        inserts.push([complex.id, sggCd, sidoCode, sggInfo.sido, sggInfo.localName]);
        matched++;
      } else {
        unmatched++;
      }
    } else {
      unmatched++;
    }
  }

  // Step 5: Batch insert
  console.log(`5. Inserting ${inserts.length} mappings...`);
  const BATCH = 500;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH);
    const values = batch.map((_, idx) => {
      const base = idx * 5;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    }).join(',');
    const params = batch.flat();
    await pool.query(`
      INSERT INTO complex_regions (complex_id, sgg_cd, sido_code, sido_name, sgg_name)
      VALUES ${values}
      ON CONFLICT (complex_id) DO UPDATE SET
        sgg_cd = EXCLUDED.sgg_cd,
        sido_code = EXCLUDED.sido_code,
        sido_name = EXCLUDED.sido_name,
        sgg_name = EXCLUDED.sgg_name
    `, params);
    process.stdout.write(`   ${Math.min(i + BATCH, inserts.length)}/${inserts.length}\r`);
  }

  console.log(`\n\n=== Results ===`);
  console.log(`Matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Match rate: ${(matched / complexes.length * 100).toFixed(1)}%`);

  // Verify
  const { rows: [{ count }] } = await pool.query('SELECT count(*)::int AS count FROM complex_regions');
  console.log(`\nRows in complex_regions: ${count}`);

  // Show sido breakdown
  const { rows: sidoBreakdown } = await pool.query(`
    SELECT sido_name, count(*)::int AS cnt
    FROM complex_regions
    GROUP BY sido_name
    ORDER BY cnt DESC
  `);
  console.log('\nSido breakdown:');
  for (const row of sidoBreakdown) {
    console.log(`  ${row.sido_name}: ${row.cnt}`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
