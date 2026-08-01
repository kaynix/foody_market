const sensitivePatterns: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/((?:token|secret|password|cookie|authorization)["'\s:=]+)[^\s,;}]+/gi, '$1[REDACTED]'],
  [/\+?\d[\d ()-]{6,}\d/g, '[REDACTED_PHONE]'],
];

export function redactText(value: unknown, maxLength = 1000): string {
  const source = value instanceof Error ? value.message : String(value ?? 'Unknown error');
  return sensitivePatterns.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    source,
  ).slice(0, maxLength);
}

export function safeErrorForLog(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return `${name}: ${redactText(error)}`;
}
