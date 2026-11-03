/**
 * 注册输入校验（纯函数，无任何服务端依赖）
 *
 * 与 lib/auth.ts 的职责分离：这里只做「格式与强度」判断，
 * 不碰数据库、不做哈希，因此可在单元测试里直接断言安全策略。
 *
 * 密码策略直接决定暴力破解的难度：bcrypt 只是让「每次猜测」变慢，
 * 但拦不住「弱密码」——攻击者第一件事就是拿常见密码表去试。
 * 所以强度校验和 bcrypt 成本因子是暴力破解防护的两个正交手段。
 */

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 上限

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, reason: "请输入邮箱" };
  if (trimmed.length > MAX_EMAIL_LENGTH) return { ok: false, reason: "邮箱过长" };
  if (!EMAIL_RE.test(trimmed)) return { ok: false, reason: "邮箱格式不正确" };
  return { ok: true };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `密码至少 ${MIN_PASSWORD_LENGTH} 位` };
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return { ok: false, reason: "密码需同时包含字母和数字" };
  }
  return { ok: true };
}
