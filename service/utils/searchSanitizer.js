const SearchLog = require('../models/SearchLog');

// Danh sách từ khóa cấm/spam hoặc ký tự độc hại
const URL_REGEX = /(https?:\/\/|www\.|\.com|\.vn|\.net|\.org|<script|<\/script|<|>|\{|\}|\$)/i;
const LETTER_OR_NUMBER_REGEX = /[\p{L}\p{N}]/u;

/**
 * Làm sạch và kiểm tra tính hợp lệ của từ khóa tìm kiếm:
 * - Độ dài từ 2 đến 50 ký tự.
 * - Loại bỏ HTML tags, ký tự điều khiển, khoảng trắng thừa.
 * - Chặn link website, mã độc XSS/SQLi.
 * - Bắt buộc phải chứa ít nhất một chữ cái hoặc chữ số có nghĩa.
 */
function sanitizeSearchKeyword(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Cắt bỏ HTML tags và khoảng trắng thừa
  let clean = raw.replace(/<[^>]*>?/gm, '').trim().replace(/\s+/g, ' ');

  if (clean.length < 2 || clean.length > 50) return null;

  // Chặn link hoặc mã script
  if (URL_REGEX.test(clean)) return null;

  // Bắt buộc phải có ít nhất một chữ cái (tiếng Việt/Latin) hoặc chữ số
  if (!LETTER_OR_NUMBER_REGEX.test(clean)) return null;

  return clean;
}

/**
 * Ghi nhận lượt tìm kiếm an toàn:
 * - Tự động sanitize từ khóa.
 * - Cơ chế Rate Limit / Anti-Spam: Không ghi nhận nếu cùng một phiên (session)
 *   hoặc cùng một khách hàng tìm kiếm lại chính từ khóa đó trong vòng 15 giây.
 */
async function recordSearchLogSafely({ keyword, resultCount = 0, customerId = null, sessionId = '' }) {
  try {
    const cleanKw = sanitizeSearchKeyword(keyword);
    if (!cleanKw) return null;

    const normalized = cleanKw.toLowerCase();

    // Chống spam: kiểm tra trong vòng 15 giây qua đã có lượt tìm trùng lặp chưa
    const fifteenSecondsAgo = new Date(Date.now() - 15000);
    const spamFilter = {
      normalizedKeyword: normalized,
      createdAt: { $gte: fifteenSecondsAgo },
    };

    if (sessionId && customerId) {
      spamFilter.$or = [{ sessionId }, { customerId }];
    } else if (sessionId) {
      spamFilter.sessionId = sessionId;
    } else if (customerId) {
      spamFilter.customerId = customerId;
    }

    const recent = await SearchLog.findOne(spamFilter);
    if (recent) {
      // Đã ghi nhận lượt tìm này gần đây từ cùng người dùng/phiên, bỏ qua để chống spam count
      return null;
    }

    return await SearchLog.create({
      keyword: cleanKw,
      normalizedKeyword: normalized,
      resultCount: Number(resultCount) || 0,
      customerId: customerId || null,
      sessionId: sessionId || '',
    });
  } catch (err) {
    // Không làm gián đoạn luồng chính nếu ghi log gặp lỗi
    return null;
  }
}

module.exports = {
  sanitizeSearchKeyword,
  recordSearchLogSafely,
};
