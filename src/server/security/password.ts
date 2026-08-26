/** 密码强度规则（注册/改密前后端共用）：≥8 位且同时含字母与数字，上限 128 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const PASSWORD_RULE_MSG = "密码需至少 8 位，且同时包含字母与数字";

export function isStrongPassword(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}
