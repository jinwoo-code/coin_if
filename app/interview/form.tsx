"use client";
// 인터뷰 안에서 쓰는 입력 카드들(스펙, 생활 조건, 원하는 것)
import { FileUp, Github, Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { HateTag, Life, Spec, Wants } from "@/lib/types";
import { WORLDS } from "@/lib/worlds";

// ---------- 작은 입력 부품 ----------

export function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="label">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={`min-h-[40px] rounded-full border px-3.5 text-sm transition-colors ${value === o.v ? "border-ink bg-ink font-semibold text-white" : "border-hair bg-surface hover:border-ink"}`}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Multi<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T[]; options: T[]; onChange: (v: T[]) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="label">
        {label}
      </span>
      {hint ? <span className="-mt-1 text-cap text-muted">{hint}</span> : null}
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`min-h-[40px] rounded-full border px-3.5 text-sm transition-colors ${on ? "border-ink bg-ink font-semibold text-white" : "border-hair bg-surface hover:border-ink"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Num({ label, value, onChange, unit, placeholder, step = 1, min = 0, max }: { label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; placeholder?: string; step?: number; min?: number; max?: number }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="field num min-w-0 flex-1"
          value={value ?? ""}
          step={step}
          min={min}
          max={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {unit ? <span className="flex-none text-sm text-muted">{unit}</span> : null}
      </span>
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, unit, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string; step?: number }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="num text-sm font-bold">
          {value}
          {unit}
        </span>
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-ink" />
    </label>
  );
}

// ---------- 스펙(전공 무관) ----------

// 졸업예정이면 다가오는 2월까지 남은 개월(한국 대학 졸업 시기)
export function monthsToFeb(now = new Date()) {
  const m = now.getMonth() + 1; // 1~12
  return m <= 2 ? 2 - m + 1 : 14 - m + 1;
}

const COMMON_CERTS = ["컴활1급", "컴활2급", "한국사1급", "한국사2급", "운전면허"];

// 전공과 관련된 진로들이 쓰는 자격증을 먼저 보여 준다.
function certSuggestions(major: string) {
  const m = major.replace(/\s/g, "");
  const related = WORLDS.filter((w) => w.majors.some((k) => m.includes(k))).flatMap((w) => w.certs);
  // 관련 진로가 있으면 그 자격증 + 공통 자격증만, 없으면 전체에서 몇 개
  const rest = related.length ? [] : WORLDS.flatMap((w) => w.certs);
  return Array.from(new Set([...related, ...COMMON_CERTS, ...rest])).slice(0, 14);
}

const IT_WORDS = ["컴퓨터", "소프트웨어", "정보", "전산", "IT", "게임", "데이터", "인공지능", "모바일"];

export function SpecForm({
  spec,
  major,
  onChange,
  onImported,
}: {
  spec: Spec;
  major: string;
  onChange: (s: Spec) => void;
  onImported: (src: "resume" | "github", extra?: { experiences?: string; coding?: number }) => void;
}) {
  const [busy, setBusy] = useState<"" | "resume" | "github">("");
  const [msg, setMsg] = useState("");
  const [gh, setGh] = useState(spec.github ?? "");
  const [custom, setCustom] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Spec>) => onChange({ ...spec, ...p });
  const isIT = IT_WORDS.some((w) => major.includes(w));
  const suggestions = Array.from(new Set([...certSuggestions(major), ...spec.certs]));

  async function upload(file: File) {
    setBusy("resume");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const s = data.spec as Partial<Spec> & { experiences?: string };
      const clean = Object.fromEntries(Object.entries(s).filter(([k, v]) => v !== null && v !== undefined && k !== "experiences")) as Partial<Spec>;
      onChange({ ...spec, ...clean, certs: Array.from(new Set([...spec.certs, ...(clean.certs ?? [])])) });
      onImported("resume", { experiences: s.experiences });
      setMsg("이력서에서 찾은 내용을 채웠어요. 틀린 건 고쳐 주세요.");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "이력서를 읽지 못했어요.");
    } finally {
      setBusy("");
    }
  }

  async function github() {
    if (!gh.trim()) return;
    setBusy("github");
    setMsg("");
    try {
      const res = await fetch(`/api/github?user=${encodeURIComponent(gh.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange({ ...spec, github: data.user, projects: Math.max(spec.projects, data.projects) });
      onImported("github", { coding: data.codingLevel });
      setMsg(`공개 저장소 ${data.repos}개${data.langs.length ? `(${data.langs.join(", ")})` : ""}를 확인했어요.`);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "GitHub에 연결하지 못했어요.");
    } finally {
      setBusy("");
    }
  }

  function addCustom() {
    const c = custom.trim();
    if (!c) return;
    set({ certs: Array.from(new Set([...spec.certs, c])) });
    setCustom("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid gap-2 ${isIT ? "sm:grid-cols-2" : ""}`}>
        <button type="button" className="btn-ghost min-h-[48px] text-sm" onClick={() => fileRef.current?.click()} disabled={busy !== ""}>
          {busy === "resume" ? <Loader2 aria-hidden="true" size={18} className="animate-spin" /> : <FileUp aria-hidden="true" size={18} />} 이력서 PDF로 채우기
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" aria-label="이력서 파일" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {isIT ? (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              github();
            }}
          >
            <label htmlFor="gh" className="sr-only">
              GitHub 아이디
            </label>
            <input id="gh" name="gh" autoComplete="off" spellCheck={false} className="field min-w-0 flex-1" placeholder="GitHub 아이디…" value={gh} onChange={(e) => setGh(e.target.value)} />
            <button type="submit" aria-label="GitHub 확인" className="btn-ghost min-h-[48px] flex-none px-3" disabled={busy !== "" || !gh.trim()}>
              {busy === "github" ? <Loader2 aria-hidden="true" size={18} className="animate-spin" /> : <Github aria-hidden="true" size={18} />}
            </button>
          </form>
        ) : null}
      </div>
      {msg ? (
        <p role="status" className="rounded-xl bg-ground px-3 py-2 text-cap">
          {msg}
        </p>
      ) : null}
      <Seg label="학교" value={spec.school} options={(["고졸", "전문대", "4년제", "대학원"] as const).map((v) => ({ v, t: v }))} onChange={(school) => set({ school })} />
      <Seg
        label="지금"
        value={spec.status}
        options={(["재학", "졸업예정", "졸업"] as const).map((v) => ({ v, t: v }))}
        onChange={(status) => set({ status, gradIn: status === "졸업" ? 0 : status === "졸업예정" ? monthsToFeb() : Math.max(spec.gradIn, 12) })}
      />
      {spec.status === "재학" ? (
        <Seg
          label="졸업까지"
          value={spec.gradIn}
          options={[
            { v: 6, t: "반년" },
            { v: 12, t: "1년" },
            { v: 18, t: "1년 반" },
            { v: 24, t: "2년" },
            { v: 36, t: "3년 이상" },
          ]}
          onChange={(gradIn) => set({ gradIn })}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Num label="학점(4.5 만점)" value={spec.gpa} step={0.01} max={4.5} placeholder="선택" onChange={(gpa) => set({ gpa })} />
        <Num label="토익" value={spec.toeic} step={5} max={990} placeholder="선택" onChange={(toeic) => set({ toeic })} />
      </div>
      <Multi label="자격증" hint="내 전공과 관련된 자격증을 먼저 보여 줘요. 없으면 아래에 직접 적어 주세요" value={spec.certs} options={suggestions} onChange={(certs) => set({ certs })} />
      <form
        className="-mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          addCustom();
        }}
      >
        <label htmlFor="cert-custom" className="sr-only">
          자격증 직접 추가
        </label>
        <input id="cert-custom" className="field min-w-0 flex-1" placeholder="예: 요양보호사, 바리스타 2급…" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button type="submit" className="btn-ghost min-h-[48px] flex-none px-4 text-sm" disabled={!custom.trim()}>
          추가
        </button>
      </form>
      <div className="grid grid-cols-2 gap-3">
        <Num label="끝까지 해 본 프로젝트·작품·실습" value={spec.projects} unit="개" onChange={(v) => set({ projects: v ?? 0 })} />
        <Num label="공모전·대회 수상" value={spec.awards} unit="회" onChange={(v) => set({ awards: v ?? 0 })} />
        <Num label="근로·알바 경력" value={spec.workMonths} unit="개월" onChange={(v) => set({ workMonths: v ?? 0 })} />
        <Num label="인턴·현장실습" value={spec.internMonths} unit="개월" onChange={(v) => set({ internMonths: v ?? 0 })} />
      </div>
      <p className="text-cap text-muted">진로마다 필요한 준비(코딩, 포트폴리오, 면허, 실습 등)는 진로를 고른 뒤에 따로 물어봐요.</p>
    </div>
  );
}

// ---------- 생활 조건 ----------

export function LifeForm({ life, onChange }: { life: Life; onChange: (l: Life) => void }) {
  const set = (p: Partial<Life>) => onChange({ ...life, ...p });
  const runway = life.livingCost - life.support > 0 ? Math.floor(life.savings / (life.livingCost - life.support)) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Num label="모아 둔 돈" value={life.savings} unit="만원" onChange={(v) => set({ savings: v ?? 0 })} />
        <Num label="매달 집 지원" value={life.support} unit="만원" onChange={(v) => set({ support: v ?? 0 })} />
        <Num label="한 달 생활비" value={life.livingCost} unit="만원" onChange={(v) => set({ livingCost: v ?? 0 })} />
      </div>
      <p className="-mt-1 text-cap text-muted">{runway === null ? "지원만으로 생활비가 충당돼요." : `알바 없이 버틸 수 있는 기간: 약 ${runway}개월`}</p>
      <Slider label="하루에 공부·준비에 쓸 수 있는 시간" value={life.studyHours} min={1} max={14} unit="시간" onChange={(studyHours) => set({ studyHours })} />
      <Slider label="일주일 알바·근로 시간" value={life.partTimeHours} min={0} max={40} unit="시간" onChange={(partTimeHours) => set({ partTimeHours })} />
      <Seg label="사는 곳" value={life.region} options={(["서울", "경기·인천", "지방 광역시", "그 외 지역"] as const).map((v) => ({ v, t: v }))} onChange={(region) => set({ region })} />
      <Seg
        label="병역"
        value={life.military}
        options={(["군필", "미필", "면제", "해당없음"] as const).map((v) => ({ v, t: v }))}
        onChange={(military) => set({ military, enlistIn: military === "미필" ? (life.enlistIn ?? 6) : null })}
      />
      {life.military === "미필" ? (
        <Seg
          label="입대 예정"
          value={life.enlistIn ?? -1}
          options={[
            { v: 3, t: "3개월 뒤" },
            { v: 6, t: "6개월 뒤" },
            { v: 12, t: "1년 뒤" },
            { v: 24, t: "2년 뒤" },
            { v: -1, t: "아직 모름" },
          ]}
          onChange={(v) => set({ enlistIn: v === -1 ? null : v })}
        />
      ) : null}
    </div>
  );
}

// ---------- 원하는 것 ----------

const HATES: HateTag[] = ["야근", "주말근무", "민원", "반복업무", "낮은연봉", "불안정", "지방근무", "실적압박"];

export function WantsForm({ wants, onChange }: { wants: Wants; onChange: (w: Wants) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Num label="바라는 첫 연봉" value={wants.salary} unit="만원" step={100} onChange={(v) => onChange({ ...wants, salary: v ?? 0 })} />
      <Multi label="이건 정말 싫다" hint="고르면 그 일이 생겼을 때 만족도가 더 크게 깎여요" value={wants.hates} options={HATES} onChange={(hates) => onChange({ ...wants, hates })} />
    </div>
  );
}
