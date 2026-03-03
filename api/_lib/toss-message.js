import { postWithMtls } from './toss-mtls.js';

const MESSENGER_PATH = '/api-partner/v1/apps-in-toss/messenger/send-message';

/**
 * 토스 스마트 발송 유틸리티
 * @param {string} userKey - users.toss_user_id 값 (x-toss-user-key)
 * @param {string} templateSetCode - 토스 콘솔에 등록한 템플릿 코드
 * @param {object} context - 템플릿 변수 (complexName, pyeongType 등)
 * @returns {Promise<object>} 발송 결과
 */
export async function sendSmartMessage(userKey, templateSetCode, context) {
  if (!templateSetCode) {
    console.warn('[toss-message] templateSetCode not configured, skipping send');
    return { skipped: true, reason: 'no_template' };
  }

  try {
    const result = await postWithMtls(
      MESSENGER_PATH,
      { templateSetCode, context },
      { 'x-toss-user-key': userKey },
    );
    return { success: true, result };
  } catch (err) {
    console.error(`[toss-message] Failed to send to ${userKey}:`, err.message);
    return { success: false, error: err.message, status: err.status };
  }
}

// 환경변수에서 템플릿 코드 조회
export function getTemplateCode(type) {
  const map = {
    keyword_bargain: process.env.TOSS_TPL_KEYWORD_BARGAIN || '',
    price_bargain: process.env.TOSS_TPL_PRICE_BARGAIN || '',
  };
  return map[type] || '';
}
