#!/usr/bin/env node
/**
 * 급매 알림 워커 — 관심단지 사용자에게 토스 스마트 발송
 *
 * 워크플로우:
 *   1. bargain_detections에서 마지막 알림 이후 새 급매 조회
 *   2. watchlist JOIN → 해당 단지를 관심 등록한 사용자 매칭
 *   3. notification_settings 확인 → 해당 알림 타입이 ON인 사용자만
 *   4. alert_history로 중복 발송 방지
 *   5. sendSmartMessage() 호출
 *   6. 결과를 alert_history에 기록
 *
 * 사용법:
 *   node scripts/notify-bargains.mjs            # 실제 발송
 *   node scripts/notify-bargains.mjs --dry-run  # 대상자만 출력
 */

import { pool } from './db.mjs';
import { sendSmartMessage, getTemplateCode } from '../api/_lib/toss-message.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`[notify-bargains] 시작${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // 1. 최근 급매 감지 (24시간 이내, 아직 알림 안 보낸 것)
  const { rows: newBargains } = await pool.query(`
    SELECT a.id AS article_id, a.complex_id, a.bargain_type, a.space_name,
      a.deal_price, a.formatted_price, a.exclusive_space,
      c.complex_name, c.property_type AS complex_property_type
    FROM articles a
    JOIN complexes c ON c.id = a.complex_id
    WHERE a.is_bargain = true
      AND a.article_status = 'active'
      AND a.first_seen_at >= NOW() - INTERVAL '24 hours'
  `);

  if (newBargains.length === 0) {
    console.log('[notify-bargains] 새 급매 없음');
    await pool.end();
    return;
  }

  console.log(`[notify-bargains] 새 급매 ${newBargains.length}건 발견`);

  let sentCount = 0;
  let skipCount = 0;

  for (const bargain of newBargains) {
    // 2. 해당 단지를 관심 등록한 사용자 매칭
    const { rows: targets } = await pool.query(`
      SELECT w.user_id, w.pyeong_type, w.property_type,
        u.toss_user_id,
        ns.notify_keyword_bargain,
        ns.notify_price_bargain
      FROM watchlist w
      JOIN users u ON u.id = w.user_id
      LEFT JOIN notification_settings ns ON ns.user_id = w.user_id
      WHERE w.complex_id = $1
        AND (w.pyeong_type IS NULL OR w.pyeong_type = $2)
        AND (w.property_type = 'all' OR w.property_type = $3)
        AND u.toss_user_id IS NOT NULL
    `, [bargain.complex_id, bargain.space_name, bargain.complex_property_type]);

    for (const target of targets) {
      // 3. 알림 타입 필터
      const notifyKeyword = target.notify_keyword_bargain ?? true;
      const notifyPrice = target.notify_price_bargain ?? true;

      const isKeyword = bargain.bargain_type === 'keyword' || bargain.bargain_type === 'both';
      const isPrice = bargain.bargain_type === 'price' || bargain.bargain_type === 'both';

      if (isKeyword && !notifyKeyword) { skipCount++; continue; }
      if (isPrice && !isKeyword && !notifyPrice) { skipCount++; continue; }

      // 4. 중복 발송 방지
      const alertType = isKeyword ? 'keyword_bargain' : 'price_bargain';
      const { rowCount: alreadySent } = await pool.query(
        `SELECT 1 FROM alert_history WHERE user_id = $1 AND article_id = $2 AND alert_type = $3`,
        [target.user_id, bargain.article_id, alertType]
      );
      if (alreadySent > 0) { skipCount++; continue; }

      const templateCode = getTemplateCode(alertType);
      const context = {
        complexName: bargain.complex_name,
        pyeongType: bargain.space_name || '',
        price: bargain.formatted_price,
      };

      if (DRY_RUN) {
        console.log(`  [DRY] user=${target.user_id} toss=${target.toss_user_id} type=${alertType} complex=${bargain.complex_name} pyeong=${bargain.space_name || '전체'}`);
        sentCount++;
        continue;
      }

      // 5. 발송
      const result = await sendSmartMessage(target.toss_user_id, templateCode, context);

      // 6. 기록
      await pool.query(`
        INSERT INTO alert_history (user_id, article_id, alert_type, complex_id, bargain_type, message_result)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, article_id, alert_type) DO NOTHING
      `, [
        target.user_id, bargain.article_id, alertType,
        bargain.complex_id, bargain.bargain_type,
        JSON.stringify(result),
      ]);

      sentCount++;
      if (result.success) {
        console.log(`  [SENT] user=${target.user_id} complex=${bargain.complex_name}`);
      } else {
        console.log(`  [FAIL] user=${target.user_id} complex=${bargain.complex_name} err=${result.error || result.reason}`);
      }
    }
  }

  console.log(`[notify-bargains] 완료: ${sentCount}건 발송, ${skipCount}건 스킵`);
  await pool.end();
}

main().catch(err => {
  console.error('[notify-bargains] 에러:', err);
  pool.end();
  process.exit(1);
});
