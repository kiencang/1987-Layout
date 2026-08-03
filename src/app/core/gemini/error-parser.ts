export function isQuotaError(e: unknown): boolean {
  const msg = (e as Error)?.message || e?.toString() || '';
  const lowerMsg = msg.toLowerCase();
  return lowerMsg.includes('quota') || lowerMsg.includes('429') || lowerMsg.includes('resource_exhausted');
}

export function parseGeminiError(e: unknown): string {
  const msg = (e as Error)?.message || e?.toString() || '';
  if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('429')) {
    return 'Lỗi: Đã vượt quá giới hạn API miễn phí (Quota exceeded). Vui thử lại vào ngày mai hoặc đăng nhập tài khoản khác còn API miễn phí.';
  }
  if (msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('permission_denied')) {
    return 'Lỗi: Thao tác bị từ chối do API Key không hợp lệ hoặc thiếu quyền hạn (Permission Denied). Đợi một lúc rồi thử lại có thể giải quyết được vấn đề này.';
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch failed')) {
    return 'Lỗi: Bị gián đoạn mạng. Vui lòng kiểm tra lại kết nối internet.';
  }
  if (msg.toLowerCase().includes('timeout')) {
    return 'Lỗi: Quá thời gian chờ (Timeout).';
  }
  if (msg.toLowerCase().includes('bytestring') || msg.toLowerCase().includes('failed to construct \'headers\'')) {
    return 'Lỗi định dạng API Key: API Key cá nhân bạn nhập chứa ký tự không hợp lệ (như dấu cách, tiếng Việt có dấu). Vui lòng vào Cài đặt để kiểm tra lại.';
  }
  if (msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('503')) {
    return 'Lỗi: Máy chủ cung cấp AI đang quá tải, vui lòng thử lại sau một chút.';
  }
  
  // Try to parse json from msg if it's a raw google error
  try {
     let str = msg;
     if (str.includes('{')) {
       str = str.substring(str.indexOf('{'));
       const obj = JSON.parse(str);
       if (obj?.error?.message) {
         return `Lỗi từ AI: ${obj.error.message}`;
       }
     }
  } catch {
    // ignore parse error
  }

  return msg ? msg : `Lỗi không xác định trong quá trình xử lý, vui lòng thử lại.`;
}

export const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];
