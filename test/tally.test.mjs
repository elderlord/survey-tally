import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "./load-core.mjs";

const { parseTsv, classifyCell, formatAverage, tally } = loadCore();

// vm 환경의 배열·객체를 이 환경의 것으로 바꿔 deepEqual로 비교한다.
const plain = (v) => JSON.parse(JSON.stringify(v));

// 결과에서 표에 보이는 열만 뽑는다.
const table = (result) =>
  result.questions.map(({ name, valid, average, blank, excluded }) =>
    [name, valid, average, blank, excluded]);

test("로직 블록은 DOM 없이 실행된다", () => {
  assert.equal(typeof tally, "function");
});

// ---------- 칸 판정 ----------

test("classifyCell: 1~5는 유효", () => {
  for (const v of ["1", "2", "3", "4", "5"]) assert.equal(classifyCell(v), "valid", v);
});

test("classifyCell: 앞뒤 공백을 지우고 판정", () => {
  assert.equal(classifyCell("  3 "), "valid");
  assert.equal(classifyCell("\t4"), "valid");
  assert.equal(classifyCell(" 5　"), "valid"); // 줄바꿈 없는 공백, 전각 공백
});

test("classifyCell: 비었거나 공백만 있으면 빈 응답", () => {
  for (const v of ["", " ", "   ", "　", undefined]) assert.equal(classifyCell(v), "blank", JSON.stringify(v));
});

test("classifyCell: 그 밖의 값은 제외", () => {
  for (const v of ["0", "6", "-1", "3.0", "3.", "03", "+3", "1 2", "a", "３", "N/A", "3점"]) {
    assert.equal(classifyCell(v), "excluded", v);
  }
});

// ---------- 평균 ----------

test("formatAverage: 소수 둘째 자리까지 표시", () => {
  assert.equal(formatAverage(7, 2), "3.50");
  assert.equal(formatAverage(12, 3), "4.00");
  assert.equal(formatAverage(5, 1), "5.00");
});

test("formatAverage: 셋째 자리에서 반올림", () => {
  assert.equal(formatAverage(10, 3), "3.33"); // 3.333…
  assert.equal(formatAverage(11, 3), "3.67"); // 3.666…
  assert.equal(formatAverage(1, 8), "0.13"); // 0.125 → 0.13 (0.5는 올림)
});

test("formatAverage: 정확히 반인 경우도 부동소수점 오차 없이 올림", () => {
  // 201/200 = 1.005 → 1.01 (부동소수점으로는 1.00이 되기 쉬운 값)
  assert.equal(formatAverage(201, 200), "1.01");
  // 1609/400 = 4.0225 → 4.02
  assert.equal(formatAverage(1609, 400), "4.02");
  assert.equal(formatAverage(463, 200), "2.32"); // 2.315 → 2.32
});

test("formatAverage: 유효 0이면 -", () => {
  assert.equal(formatAverage(0, 0), "-");
});

// ---------- 붙여넣기 해석 ----------

test("parseTsv: 탭과 줄바꿈(\\r\\n, \\n, \\r)으로 나눈다", () => {
  assert.deepEqual(plain(parseTsv("a\tb\r\n1\t2\n3\t4\r5\t6")), [
    ["a", "b"], ["1", "2"], ["3", "4"], ["5", "6"],
  ]);
});

test("parseTsv: 엑셀 따옴표 칸(줄바꿈·탭·따옴표 포함)을 푼다", () => {
  const text = '번호\t"첫 줄\n둘째 줄"\t"탭\t포함"\t"말한 ""그것"""\r\n1\t2\t3\t4\r\n';
  assert.deepEqual(plain(parseTsv(text)), [
    ["번호", "첫 줄\n둘째 줄", "탭\t포함", '말한 "그것"'],
    ["1", "2", "3", "4"],
    [""],
  ]);
});

test("parseTsv: 칸 가운데의 따옴표는 글자 그대로", () => {
  assert.deepEqual(plain(parseTsv('a\t3"\tb"c')), [["a", '3"', 'b"c']]);
});

// ---------- 집계 ----------

test("tally: 기본 집계, 첫 열은 집계하지 않음", () => {
  const text = [
    "응답번호\t만족도\t추천 의향",
    "1\t5\t4",
    "2\t4\t4",
    "3\t3\t5",
  ].join("\r\n") + "\r\n"; // 엑셀은 끝에 줄바꿈을 붙인다
  const r = tally(text);
  assert.equal(r.ok, true);
  assert.equal(r.respondents, 3);
  assert.deepEqual(plain(table(r)), [
    ["만족도", 3, "4.00", 0, 0],
    ["추천 의향", 3, "4.33", 0, 0],
  ]);
});

test("tally: 유효·빈 응답·제외를 나눠 센다", () => {
  const text = [
    "번호\tQ1\tQ2",
    "1\t 5 \t",
    "2\t6\t   ",
    "3\t모름\t2",
    "4\t1\t3.5",
  ].join("\n");
  assert.deepEqual(plain(table(tally(text))), [
    ["Q1", 2, "3.00", 0, 2],
    ["Q2", 1, "2.00", 2, 1],
  ]);
});

test("tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다", () => {
  const text = [
    "번호\tQ1\tQ2\tQ3",
    "1\t5\t4\t3",
    "2\t4",   // Q2, Q3 모자람
    "3",      // Q1~Q3 모자람
  ].join("\n");
  const r = tally(text);
  assert.deepEqual(plain(table(r)), [
    ["Q1", 2, "4.50", 1, 0],
    ["Q2", 1, "4.00", 2, 0],
    ["Q3", 1, "3.00", 2, 0],
  ]);
  assert.equal(r.shortRows, 2);
});

test("tally: 머리글보다 많은 칸은 무시한다", () => {
  const r = tally("번호\tQ1\n1\t5\t5\t5");
  assert.deepEqual(plain(table(r)), [["Q1", 1, "5.00", 0, 0]]);
  assert.equal(r.longRows, 1);
});

test("tally: 유효 응답이 없으면 평균은 -", () => {
  const r = tally("번호\tQ1\tQ2\n1\t\tx\n2\t \t0");
  assert.deepEqual(plain(table(r)), [
    ["Q1", 0, "-", 2, 0],
    ["Q2", 0, "-", 0, 2],
  ]);
});

test("tally: 머리글만 있으면 모두 0", () => {
  const r = tally("번호\tQ1\tQ2\n");
  assert.equal(r.ok, true);
  assert.equal(r.respondents, 0);
  assert.deepEqual(plain(table(r)), [
    ["Q1", 0, "-", 0, 0],
    ["Q2", 0, "-", 0, 0],
  ]);
});

test("tally: 앞뒤의 빈 줄은 버리고 가운데 빈 줄은 빈 응답 줄로 센다", () => {
  const r = tally("\n\n번호\tQ1\n1\t4\n\n2\t2\n\n\n");
  assert.equal(r.respondents, 3);
  assert.deepEqual(plain(table(r)), [["Q1", 2, "3.00", 1, 0]]);
});

test("tally: 머리글의 앞뒤 공백은 지우고, 빈 머리글에는 이름을 붙인다", () => {
  const r = tally(" 번호 \t  만족도 \t\n1\t3\t4");
  assert.deepEqual(plain(table(r)).map((row) => row[0]), ["만족도", "(제목 없음, 3열)"]);
});

test("tally: 머리글에 줄바꿈이 든 문항(엑셀 따옴표)도 한 문항으로 읽는다", () => {
  const r = tally('번호\t"서비스에\n만족하십니까?"\n1\t5\n2\t3\n');
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].name, "서비스에\n만족하십니까?");
  assert.equal(r.questions[0].average, "4.00");
});

test("tally: 빈 입력은 오류", () => {
  for (const text of ["", "\n\n", "   ", null, undefined]) {
    const r = tally(text);
    assert.equal(r.ok, false, JSON.stringify(text));
    assert.match(r.error, /붙여넣은 내용이 없습니다/);
  }
});

test("tally: 문항 열이 없으면 오류", () => {
  const r = tally("응답번호\n1\n2");
  assert.equal(r.ok, false);
  assert.match(r.error, /집계할 문항이 없습니다/);
});

test("tally: 칸마다 유효+빈 응답+제외 = 응답자 수", () => {
  const text = [
    "번호\tA\tB\tC",
    "1\t1\t\tz",
    "2\t2\t7",
    "3",
    "4\t5\t5\t5\t9",
    "5\t \t \t ",
  ].join("\n");
  const r = tally(text);
  for (const q of r.questions) {
    assert.equal(q.valid + q.blank + q.excluded, r.respondents, q.name);
  }
});
