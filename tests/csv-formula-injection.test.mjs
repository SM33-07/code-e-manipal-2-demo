import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { sanitizeCsvCell } from '../lib/utils/csv.ts';

describe('CSV Formula Injection Defense & Serialization (CWE-1236)', () => {
  test('1. Neutralizes malicious formula prefixes (=, +, -, @)', () => {
    assert.equal(sanitizeCsvCell('=cmd|\' /C calc\'!A0'), '"\'=cmd|\' /C calc\'!A0"');
    assert.equal(sanitizeCsvCell('+1+1'), '"\'+1+1"');
    assert.equal(sanitizeCsvCell('-2+3'), '"\'-2+3"');
    assert.equal(sanitizeCsvCell('@SUM(A1:A10)'), '"\'@SUM(A1:A10)"');
  });

  test('2. Neutralizes formulas preceded by whitespace or control characters', () => {
    assert.equal(sanitizeCsvCell('   =1+1'), "\"\'   =1+1\"");
    assert.equal(sanitizeCsvCell('\t=calc'), "\"\'\t=calc\"");
    assert.equal(sanitizeCsvCell('\r=calc'), "\"\'\r=calc\"");
    assert.equal(sanitizeCsvCell('\n=calc'), "\"\'\n=calc\"");
    assert.equal(sanitizeCsvCell('  @alert(1)'), "\"\'  @alert(1)\"");
    assert.equal(sanitizeCsvCell(' \t +cmd'), "\"\' \t +cmd\"");
  });

  test('3. Preserves legitimate pure negative and positive numeric semantics', () => {
    // Pure numeric values must NOT be prefixed with single quote
    assert.equal(sanitizeCsvCell(-42), '"-42"');
    assert.equal(sanitizeCsvCell('-42'), '"-42"');
    assert.equal(sanitizeCsvCell('-3.14159'), '"-3.14159"');
    assert.equal(sanitizeCsvCell(-3.14159), '"-3.14159"');
    assert.equal(sanitizeCsvCell(100), '"100"');
    assert.equal(sanitizeCsvCell('100'), '"100"');
    assert.equal(sanitizeCsvCell('0'), '"0"');
    assert.equal(sanitizeCsvCell(0), '"0"');
    assert.equal(sanitizeCsvCell('-0.5'), '"-0.5"');
  });

  test('4. Handles standard CSV escaping for quotes, commas, newlines, and UTF-8', () => {
    assert.equal(sanitizeCsvCell('Hello, World'), '"Hello, World"');
    assert.equal(sanitizeCsvCell('He said "Hello"'), '"He said ""Hello"""');
    assert.equal(sanitizeCsvCell('Line 1\r\nLine 2'), '"Line 1\r\nLine 2"');
    assert.equal(sanitizeCsvCell('संकेत / 特别 / — em-dash'), '"संकेत / 特别 / — em-dash"');
  });

  test('5. Handles null, undefined, boolean, and serialized JSON objects', () => {
    assert.equal(sanitizeCsvCell(null), '""');
    assert.equal(sanitizeCsvCell(undefined), '""');
    assert.equal(sanitizeCsvCell(true), '"true"');
    assert.equal(sanitizeCsvCell(false), '"false"');

    const obj = { action: 'LOGIN', success: true };
    assert.equal(sanitizeCsvCell(obj), '"{""action"":""LOGIN"",""success"":true}"');
  });

  test('6. Verifies audit export route enforces admin authorization and bounded export size', () => {
    const routeFilePath = path.resolve(process.cwd(), 'app/api/admin/audit-logs/export/route.ts');
    const source = fs.readFileSync(routeFilePath, 'utf8');

    // Admin role enforcement
    assert.ok(source.includes("withAuth(async"), 'Export route must be wrapped in withAuth');
    assert.ok(source.includes("'admin'"), 'Export route must strictly require admin role');

    // Bounded export limit
    assert.ok(source.includes("LIMIT 1000"), 'Export query must bound result set to LIMIT 1000');
  });
});
