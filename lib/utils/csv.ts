/**
 * Code-e-Manipal 2.0 — CSV Sanitization & Serialization Utility
 * Protects against CSV formula injection (CWE-1236 / Spreadsheet Formula Injection).
 *
 * Vulnerable trigger prefixes: '=', '+', '-', '@', '\t', '\r'
 * Also neutralizes formula characters preceded by whitespace or control characters.
 * Preserves valid negative and positive numeric values, dates, strings, and JSON objects.
 */

export function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) {
    return '""';
  }

  let s: string;
  if (typeof val === 'number') {
    return `"${val}"`;
  } else if (typeof val === 'boolean') {
    return `"${val}"`;
  } else if (typeof val === 'object') {
    s = JSON.stringify(val);
  } else {
    s = String(val);
  }

  // Check if string is a legitimate pure numeric value (e.g. "-123", "-4.5", "100")
  const isPureNumber = /^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s.trim());

  if (!isPureNumber) {
    // Formula triggers: '=', '+', '-', '@', '\t', '\r' optionally preceded by whitespace or control chars
    if (/^[\s\u0000-\u001f]*[=+\-@\t\r]/.test(s)) {
      s = `'` + s;
    }
  }

  return `"${s.replace(/"/g, '""')}"`;
}
