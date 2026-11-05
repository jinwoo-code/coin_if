"use client";
// 공유본 PDF: 공유 창에서 만든 공유본을 그려 인쇄 창을 연다(인쇄 창에서 PDF로 저장).
import { useEffect, useState } from "react";
import { SharedReportView } from "@/components/shared-report";
import type { SharedReport } from "@/lib/shared-report";

export default function PrintPage() {
  const [data, setData] = useState<SharedReport | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cr:sharePrint");
      if (raw) {
        setData(JSON.parse(raw) as SharedReport);
        setTimeout(() => window.print(), 300);
      }
    } catch {
      setData(null);
    }
  }, []);
  if (!data) return <p className="p-8 text-sm text-muted">리포트의 공유 창에서 다시 눌러 주세요.</p>;
  return <SharedReportView data={data} />;
}
