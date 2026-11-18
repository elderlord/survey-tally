// index.html에서 <script id="game-core"> 블록만 꺼내 DOM 없는 빈 환경에서 실행한다.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

export function loadCore() {
  const m = html.match(/<script id="game-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="game-core"> 블록이 없습니다');
  const context = vm.createContext({});
  vm.runInContext(m[1], context);
  return context.Samok;
}
