// index.html이 외부 자원을 쓰지 않고 바깥으로 연결하지 않는지 정적으로 검사한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "./load-core.mjs";

test("외부 주소를 참조하지 않는다", () => {
  assert.doesNotMatch(html, /\b(?:https?|wss?|ftp):\/\//i);
});

test("외부 라이브러리·글꼴·이미지·프레임을 불러오지 않는다", () => {
  const forbidden = [
    /<script[^>]*\bsrc\s*=/i,
    /<link\b/i,
    /<img\b/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i,
    /@import/i,
    /@font-face/i,
    /url\s*\(/i,
  ];
  for (const re of forbidden) assert.doesNotMatch(html, re, String(re));
});

test("네트워크·저장 API를 쓰지 않는다", () => {
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/,
    /WebSocket/,
    /EventSource/,
    /serviceWorker/,
    /localStorage/,
    /sessionStorage/,
    /indexedDB/,
    /document\.cookie/,
  ];
  for (const re of forbidden) assert.doesNotMatch(html, re, String(re));
});

test("CSP가 모든 외부 연결을 기본 차단한다", () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, "CSP meta 태그가 있어야 한다");
  const directives = Object.fromEntries(
    m[1].split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]),
  );
  assert.deepEqual(Object.keys(directives).sort(), ["base-uri", "default-src", "form-action", "script-src", "style-src"]);
  assert.deepEqual(directives["default-src"], ["'none'"]);
  assert.deepEqual(directives["base-uri"], ["'none'"]);
  assert.deepEqual(directives["form-action"], ["'none'"]);
  assert.deepEqual(directives["script-src"], ["'unsafe-inline'"]);
  assert.deepEqual(directives["style-src"], ["'unsafe-inline'"]);
});

test("HTML을 문자열로 끼워 넣지 않는다", () => {
  assert.doesNotMatch(html, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});
