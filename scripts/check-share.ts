// 공유본 단위 테스트: 모르는 칸 버리기, 이야기 원문 섞임 지우기, 길이 자르기.
import assert from "node:assert/strict";
import { isDemoPerson, NURSE_DEMO_PROFILE } from "@/lib/demo";
import { cleanShared, rawSnippets, scrubShared } from "@/lib/shared-report";

const base = { person: { name: "가", major: "나", dilemma: "고민 글", experiences: "경험 글" }, createdAt: "2026-11-05", storyRaw: { a: { b: "원문" } }, holdoutPicks: { s7: 1 }, woop: { wish: "w", obstacle: "o", plan: "p", outcome: "c", extra: "x" }, forks: [], week: [{ when: "a", where: "b", what: "c", secret: "s" }], worlds: [{ id: "nurse", name: "간호사", fit: 50, answers: { q1: 3 }, gap: { top: [{ title: "t", why: ["y"], status: "없음", raw: "r" }] }, plan: { rows: [] }, evidence: [] }] };
const c = cleanShared(base)!;
const json = JSON.stringify(c);
for (const bad of ["dilemma", "experiences", "storyRaw", "holdoutPicks", "answers", "secret", "extra", "고민 글", "경험 글"]) assert.ok(!json.includes(bad), bad);
assert.equal(c.worlds[0].gap.top[0].title, "t");
console.log("통과 모르는 칸은 버린다");
assert.equal(cleanShared({ worlds: [] }), null);
assert.equal(cleanShared(null), null);
assert.equal(cleanShared({ ...base, person: { name: "가".repeat(500), major: "" } })!.person.name.length, 40);
console.log("통과 빈 값·긴 값");
const snippets = rawSnippets({ storyRaw: { c1: { "0:a": "일단 해 보자고 생각했어요. 짧다" } }, story: { decisionStyle: { value: "impulsive", evidence: "끝까지 해 낸 적이 있어요" }, note: "x" } });
assert.ok(snippets.includes("일단 해 보자고 생각했어요") && snippets.includes("끝까지 해 낸 적이 있어요"));
const s = scrubShared({ ...c, woop: { ...c.woop, obstacle: "\"일단 해 보자고 생각했어요\"라고 해서 흔들려요" } }, snippets);
assert.equal(s.woop.obstacle, "");
assert.equal(s.woop.plan, "p");
console.log("통과 원문이 섞인 칸은 지운다");
assert.ok(isDemoPerson(NURSE_DEMO_PROFILE) && !isDemoPerson({ name: "다른 사람", major: "간호학과 3학년" }));
console.log("통과 시연 인물 판별");
