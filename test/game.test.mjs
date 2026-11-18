import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const Samok = loadCore();
const { SIZE, WIN_LENGTH, createGame, play, undo, findWinLine } = Samok;

// vm 환경의 배열·객체를 이 환경의 것으로 바꿔 deepEqual로 비교한다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const at = (r, c) => r * SIZE + c;

// 수를 차례로 두고 마지막 상태를 돌려준다. 실패하면 시험을 멈춘다.
function playAll(moves, state = createGame()) {
  for (const index of moves) {
    const result = play(state, index);
    assert.equal(result.ok, true, `${index}에 둘 수 없음: ${result.error}`);
    state = result.state;
  }
  return state;
}

test("로직 블록은 DOM 없이 실행된다", () => {
  assert.equal(typeof play, "function");
  assert.equal(SIZE, 10);
  assert.equal(WIN_LENGTH, 3);
});

test("새 게임: 빈 10x10 판, 흑 차례", () => {
  const g = createGame();
  assert.equal(g.board.length, 100);
  assert.ok(g.board.every((cell) => cell === null));
  assert.equal(g.turn, "B");
  assert.equal(g.winner, null);
  assert.equal(g.draw, false);
  assert.deepEqual(plain(g.moves), []);
});

test("흑·백이 번갈아 둔다", () => {
  const g = playAll([at(0, 0), at(5, 5), at(9, 9)]);
  assert.equal(g.board[at(0, 0)], "B");
  assert.equal(g.board[at(5, 5)], "W");
  assert.equal(g.board[at(9, 9)], "B");
  assert.equal(g.turn, "W");
  assert.deepEqual(plain(g.moves), [0, 55, 99]);
});

test("play는 원래 상태를 바꾸지 않는다", () => {
  const g = createGame();
  const before = plain(g);
  play(g, 42);
  assert.deepEqual(plain(g), before);
});

test("이미 돌이 있는 칸에는 둘 수 없다", () => {
  const g = playAll([at(3, 3)]);
  const r = play(g, at(3, 3));
  assert.equal(r.ok, false);
  assert.equal(r.error, "occupied");
});

test("판 밖이나 정수가 아닌 칸에는 둘 수 없다", () => {
  for (const index of [-1, 100, 3.5, NaN, "5", undefined]) {
    assert.equal(play(createGame(), index).error, "out-of-range", String(index));
  }
});

for (const [name, line] of [
  ["가로", [at(4, 2), at(4, 3), at(4, 4)]],
  ["세로", [at(1, 7), at(2, 7), at(3, 7)]],
  ["대각선 ↘", [at(6, 1), at(7, 2), at(8, 3)]],
  ["대각선 ↗", [at(9, 0), at(8, 1), at(7, 2)]],
]) {
  test(`${name}으로 3개를 이으면 승리`, () => {
    // 흑이 line을 두는 사이 백은 멀리 떨어진 곳에 둔다.
    const filler = [at(0, 0), at(0, 9)];
    const g = playAll([line[0], filler[0], line[1], filler[1], line[2]]);
    assert.equal(g.winner, "B");
    assert.deepEqual(plain(g.winLine), [...line].sort((a, b) => a - b));
    assert.equal(g.turn, "B", "끝난 뒤에는 차례가 넘어가지 않는다");
  });
}

test("가운데를 마지막에 채워도 승리", () => {
  const g = playAll([at(5, 3), at(0, 0), at(5, 5), at(0, 9), at(5, 4)]);
  assert.equal(g.winner, "B");
  assert.deepEqual(plain(g.winLine), [at(5, 3), at(5, 4), at(5, 5)]);
});

test("판 가장자리를 넘어 이어 붙이지 않는다", () => {
  // (0,8)(0,9)와 (1,0)은 번호로는 8, 9, 10으로 이어지지만 같은 줄이 아니다.
  const g = playAll([at(0, 8), at(5, 5), at(0, 9), at(7, 7), at(1, 0)]);
  assert.equal(g.winner, null);
  assert.equal(g.turn, "W");
});

test("2개만 이어진 상태는 승리가 아니다", () => {
  const g = playAll([at(2, 2), at(9, 9), at(2, 3)]);
  assert.equal(g.winner, null);
  assert.deepEqual(plain(g.winLine), []);
});

test("백도 이길 수 있다", () => {
  const g = playAll([at(0, 0), at(5, 5), at(0, 4), at(5, 6), at(9, 9), at(5, 7)]);
  assert.equal(g.winner, "W");
  assert.deepEqual(plain(g.winLine), [at(5, 5), at(5, 6), at(5, 7)]);
});

test("두 방향이 동시에 이어지면 이긴 줄을 모두 표시한다", () => {
  // 흑: (4,4)(4,5) 가로, (5,6)(6,6) 세로 → (4,6)에 두면 가로·세로 동시 완성
  const g = playAll([at(4, 4), at(0, 0), at(4, 5), at(0, 3), at(5, 6), at(0, 6), at(6, 6), at(0, 9), at(4, 6)]);
  assert.equal(g.winner, "B");
  assert.deepEqual(plain(g.winLine), [at(4, 4), at(4, 5), at(4, 6), at(5, 6), at(6, 6)].sort((a, b) => a - b));
});

test("4개 이상 이어진 줄도 모두 표시한다", () => {
  // 흑이 (3,0)(3,1) _ (3,3)(3,4)을 두고 (3,2)를 채우면 5개가 이어진다
  // (그 전에 3개가 이어지지 않도록 가운데를 비워 둔다)
  const g = playAll([at(3, 0), at(9, 0), at(3, 1), at(9, 3), at(3, 3), at(9, 6), at(3, 4), at(9, 9), at(3, 2)]);
  assert.equal(g.winner, "B");
  assert.deepEqual(plain(g.winLine), [at(3, 0), at(3, 1), at(3, 2), at(3, 3), at(3, 4)]);
});

test("게임이 끝나면 더 둘 수 없다", () => {
  const g = playAll([at(0, 0), at(9, 9), at(0, 1), at(9, 8), at(0, 2)]);
  const r = play(g, at(5, 5));
  assert.equal(r.ok, false);
  assert.equal(r.error, "finished");
});

// 3개가 이어지지 않는 꽉 찬 판: 색 = ((열 + 2×행) mod 4 < 2) ? 흑 : 백
// 가로는 흑흑백백…, 세로는 흑백흑백…, 두 대각선은 흑백백흑흑… 이라 어느 방향도 2개를 넘지 않는다.
function drawMoves() {
  const black = [];
  const white = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      ((c + 2 * r) % 4 < 2 ? black : white).push(at(r, c));
    }
  }
  assert.equal(black.length, 50);
  assert.equal(white.length, 50);
  return black.flatMap((b, i) => [b, white[i]]);
}

test("승자 없이 판이 다 차면 무승부", () => {
  const g = playAll(drawMoves());
  assert.equal(g.winner, null);
  assert.equal(g.draw, true);
  assert.equal(g.moves.length, 100);
  assert.equal(play(g, 0).error, "finished");
});

test("마지막 100번째 칸으로 이기면 무승부가 아니라 승리", () => {
  // 무승부 판에서 (0,4)만 비운 99칸 상태를 만든다. 첫 행은 흑흑백백_흑백백흑흑.
  // 백이 (0,4)에 두면 가로 (0,2)(0,3)(0,4)와 대각선 (0,4)(1,5)(2,6)이 함께 이어진다.
  const full = playAll(drawMoves());
  const board = full.board.slice();
  board[at(0, 4)] = null;
  const nearlyFull = {
    board,
    turn: "W",
    moves: full.moves.filter((index) => index !== at(0, 4)),
    winner: null,
    winLine: [],
    draw: false,
  };
  const r = play(nearlyFull, at(0, 4));
  assert.equal(r.ok, true);
  assert.equal(r.state.moves.length, 100);
  assert.equal(r.state.winner, "W");
  assert.equal(r.state.draw, false);
  assert.deepEqual(plain(r.state.winLine), [at(0, 2), at(0, 3), at(0, 4), at(1, 5), at(2, 6)]);
});

test("findWinLine: 빈 칸이면 []", () => {
  assert.deepEqual(plain(findWinLine(createGame().board, 0)), []);
});

test("undo: 마지막 수를 무르고 차례를 되돌린다", () => {
  const g = playAll([at(1, 1), at(2, 2), at(3, 3)]);
  const u = undo(g);
  assert.deepEqual(plain(u.moves), [at(1, 1), at(2, 2)]);
  assert.equal(u.board[at(3, 3)], null);
  assert.equal(u.turn, "B");
});

test("undo: 이긴 수를 무르면 게임이 다시 이어진다", () => {
  const g = playAll([at(0, 0), at(9, 9), at(0, 1), at(9, 8), at(0, 2)]);
  assert.equal(g.winner, "B");
  const u = undo(g);
  assert.equal(u.winner, null);
  assert.deepEqual(plain(u.winLine), []);
  assert.equal(u.turn, "B");
  assert.equal(play(u, at(5, 5)).ok, true);
});

test("undo: 무승부를 무르면 다시 둘 수 있다", () => {
  const u = undo(playAll(drawMoves()));
  assert.equal(u.draw, false);
  assert.equal(u.moves.length, 99);
  assert.equal(u.turn, "W");
});

test("undo: 둔 수가 없으면 새 게임 그대로", () => {
  assert.deepEqual(plain(undo(createGame())), plain(createGame()));
});
