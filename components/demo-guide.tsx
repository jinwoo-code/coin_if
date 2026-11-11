"use client";
// 예시 인물로 둘러보는 사람(심사위원 등)에게만 보이는 둘러보기 순서. 예시 인물은 로그인 없이 프리미엄까지 다 열린다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { isDemoPerson } from "@/lib/demo";
import { store } from "@/lib/store";
import { T } from "@/lib/copy";

export function DemoGuide() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const p = store.getProfile();
    setShow(!!p && isDemoPerson(p));
  }, []);
  if (!show) return null;
  const steps: { title: string; note: string; href?: string }[] = [
    { title: "이 화면", note: "갈림길의 '보통 N% → 나 M%'를 눌러 근거를 펼쳐 보세요. 맨 아래에 진로 한눈에 비교가 있어요." },
    { title: `${T.lineMap}`, note: `${T.line} 나무, 갈림길 바꿔 보기, 바꿀 수 있는 것 Top 3`, href: "/multiverse" },
    { title: "그 길의 나와 대화", note: `${T.lineMap}에서 길을 고른 뒤 '대화하기'` },
    { title: "리포트", note: "결론·할 일, 예시 인물은 프리미엄(격차·일정·다시 살아 보기·공유)까지 무료", href: "/report" },
    { title: "기능 설명 전체", note: "갈래가 기능·데이터·운영 방식을 소개해요", href: "/guide" },
    { title: "갈래 이야기", note: "마스코트 갈래를 누르고, 잡고, 던져 보세요", href: "/legend" },
  ];
  return (
    <details className="mt-3 rounded-2xl border-2 border-sun bg-sunSoft px-4 py-3 text-sm" data-testid="demo-guide">
      <summary className="flex min-h-11 cursor-pointer flex-col justify-center">
        <span className="font-bold">예시로 둘러볼 곳 {steps.length}곳</span>
        <span className="text-cap text-muted">예시 인물 결과로 이 서비스의 기능을 차례로 볼 수 있는 곳이에요.</span>
      </summary>
      <ol className="mt-2 flex flex-col gap-2 pb-1">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2">
            <span className="num flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ink text-cap font-bold text-white">{i + 1}</span>
            <span className="min-w-0">
              {s.href ? (
                <Link href={s.href} className="font-bold underline underline-offset-4">
                  {s.title}
                </Link>
              ) : (
                <strong>{s.title}</strong>
              )}
              <span className="block text-muted">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
