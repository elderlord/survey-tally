// index.html이 외부 자원을 쓰거나 데이터를 내보내거나 저장하지 않는지 정적으로 검사한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "./load-core.mjs";

test("외부 주소를 참조하지 않는다", () => {
  assert.doesNotMatch(html, /\b(?:https?|wss?|ftp):\/\//i);
  assert.doesNotMatch(html, /(?:^|[^:])\/\/[a-z0-9-]+\.[a-z]/i, "프로토콜 상대 주소(//host)");
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

test("네트워크 전송 API를 쓰지 않는다", () => {
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /sendBeacon/,
    /WebSocket/,
    /EventSource/,
    /RTCPeerConnection/,
    /serviceWorker/,
    /\.submit\s*\(/,
    /window\.open\s*\(/,
    /location\s*(?:\.href)?\s*=/,
    /new\s+Image\s*\(/,
  ];
  for (const re of forbidden) assert.doesNotMatch(html, re, String(re));
});

test("저장 API를 쓰지 않는다", () => {
  const forbidden = [
    /localStorage/,
    /sessionStorage/,
    /indexedDB/,
    /document\.cookie/,
    /caches\s*\./,
    /navigator\.storage/,
  ];
  for (const re of forbidden) assert.doesNotMatch(html, re, String(re));
});

test("CSP가 모든 외부 연결을 기본 차단한다", () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, "CSP meta 태그가 있어야 한다");
  const directives = Object.fromEntries(
    m[1].split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]),
  );
  assert.deepEqual(directives["default-src"], ["'none'"]);
  assert.deepEqual(directives["form-action"], ["'none'"]);
  assert.deepEqual(directives["base-uri"], ["'none'"]);
  // default-src 'none'을 넓히는 지시어는 인라인 스크립트·스타일 허용 둘뿐이어야 한다.
  assert.deepEqual(Object.keys(directives).sort(), ["base-uri", "default-src", "form-action", "script-src", "style-src"]);
  assert.deepEqual(directives["script-src"], ["'unsafe-inline'"]);
  assert.deepEqual(directives["style-src"], ["'unsafe-inline'"]);
});

test("입력란이 맞춤법 검사·자동완성에 내용을 넘기지 않는다", () => {
  const m = html.match(/<textarea\b[^>]*>/);
  assert.ok(m);
  assert.match(m[0], /spellcheck="false"/);
  assert.match(m[0], /autocomplete="off"/);
});

test("붙여넣은 글을 HTML로 해석하지 않는다", () => {
  assert.doesNotMatch(html, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});
