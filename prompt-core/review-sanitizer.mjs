const NEVER_SAMPLE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(?:\d[ -]?){13,19}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\biban\s*[:=]?\s*[A-Z]{2}\d{2}[A-Z0-9]{10,}\b/i,
  /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/,
  /\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]/i,
  /```|\b(function|class|interface|import|package|public static|SELECT|INSERT|UPDATE|DELETE)\b[^\n]*[;{]/i,
];

export function sanitizeReviewSample(text, { developerApproved = false } = {}) {
  if (!developerApproved) {
    return { eligible: false, reasonCode: "DEVELOPER_APPROVAL_REQUIRED" };
  }
  if (typeof text !== "string" || !text.trim()) {
    return { eligible: false, reasonCode: "EMPTY_SAMPLE" };
  }
  if (NEVER_SAMPLE.some((pattern) => pattern.test(text))) {
    return { eligible: false, reasonCode: "PROHIBITED_CONTENT_DETECTED" };
  }
  const sanitized = text
    .slice(0, 1000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s/\\]+[\/\\])+[^\s/\\]+/g, "[PATH]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[IDENTIFIER]");
  return {
    eligible: true,
    reasonCode: "SANITIZED_LOCAL_SAMPLE",
    sanitized,
    expiresAfterHours: 168,
  };
}
