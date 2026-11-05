"use client";
// 이번 주 할 일: 언제·어디서·무엇을 직접 고치고 저장한다. 예시는 하나만 채워 준다. 이 기기에만 저장.
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { store } from "@/lib/store";
import type { Report } from "@/lib/types";
import type { WeekEntry } from "@/lib/woop";

const WHEN = ["오늘 저녁", "내일 수업 끝나고", "수요일 저녁", "이번 주말 오전"];
const WHERE = ["집", "학교 도서관", "카페", "온라인"];
const newId = () => `w${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

function first(report: Report): WeekEntry[] {
  const saved = store.getWeekPlan();
  if (saved) return saved;
  const e = report.example ?? { when: "수요일 수업 끝나고", where: "학교 도서관", what: report.todos[0] ?? "" };
  return [{ id: "example", ...e, example: true }];
}

export function WeekPlan({ report }: { report: Report }) {
  const [items, setItems] = useState<WeekEntry[]>(() => first(report));
  const save = (next: WeekEntry[]) => {
    setItems(next);
    store.setWeekPlan(next);
  };
  const patch = (id: string, p: Partial<WeekEntry>) => save(items.map((x) => (x.id === id ? { ...x, ...p, example: false } : x)));
  const add = (what: string) => save([...items, { id: newId(), when: "", where: "", what }]);
  const ideas = report.todos.filter((t) => !items.some((x) => x.what === t));

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="todo" data-testid="week-plan">
      <h2 id="todo" className="text-xl font-bold">
        이번 주 할 일
      </h2>
      <p className="mt-1 text-cap text-muted">언제, 어디서, 무엇을 할지 정하면 실제로 할 가능성이 높아져요. 이 기기에만 저장돼요.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((t, i) => (
          <li key={t.id} className="rounded-lg border border-hair p-3">
            {t.example ? <p className="mb-2 text-cap font-medium text-muted">예시예요. 내 상황에 맞게 고쳐 주세요.</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-cap font-medium">
                언제
                <input list="week-when" value={t.when} maxLength={30} placeholder="예: 수요일 저녁" onChange={(e) => patch(t.id, { when: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-hair px-3 text-sm font-normal" />
              </label>
              <label className="text-cap font-medium">
                어디서
                <input list="week-where" value={t.where} maxLength={30} placeholder="예: 학교 도서관" onChange={(e) => patch(t.id, { where: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-hair px-3 text-sm font-normal" />
              </label>
            </div>
            <label className="mt-2 block text-cap font-medium">
              무엇을
              <input value={t.what} maxLength={60} placeholder="작게, 한 번에 끝낼 수 있는 일" onChange={(e) => patch(t.id, { what: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-hair px-3 text-sm font-normal" />
            </label>
            <div className="mt-1 flex items-center justify-between">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="peer sr-only" checked={Boolean(t.done)} onChange={(e) => save(items.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)))} />
                <span aria-hidden="true" className="flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 border-hair text-transparent peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2">
                  <Check size={15} strokeWidth={3} />
                </span>
                해 봤어요
              </label>
              <button type="button" aria-label={`${i + 1}번째 할 일 지우기`} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-black/5" onClick={() => save(items.filter((x) => x.id !== t.id))}>
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <datalist id="week-when">{WHEN.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="week-where">{WHERE.map((x) => <option key={x} value={x} />)}</datalist>
      {ideas.length ? (
        <>
          <p className="mt-4 text-cap font-medium">이런 일은 어때요</p>
          <ul className="mt-1 flex flex-col">
            {ideas.map((t) => (
              <li key={t}>
                <button type="button" className="flex min-h-11 w-full items-center gap-2 text-left text-sm" onClick={() => add(t)}>
                  <Plus aria-hidden="true" size={16} className="flex-none" /> {t}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <button type="button" className="mt-2 min-h-11 text-sm font-medium underline" onClick={() => add("")}>
        직접 하나 더 쓰기
      </button>
      <p className="mt-2 text-cap text-muted">한 달 뒤 체크인에서 해 본 일을 입력하면 시뮬레이션을 다시 돌려 볼 수 있어요.</p>
    </section>
  );
}
