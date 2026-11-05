// 상담사가 보는 읽기 전용 공유본. 로그인 없이 열린다. 만료·취소되면 내용을 안 보여 준다.
import type { Metadata } from "next";
import { SharedReportView } from "@/components/shared-report";
import { readShare } from "@/lib/share-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "공유된 진로 리허설 결과", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedPage({ params }: { params: { token: string } }) {
  const found = await readShare(params.token);
  if (!found)
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16 text-center">
        <h1 className="text-xl font-bold">볼 수 없는 링크예요</h1>
        <p className="mt-2 text-sm text-muted">만료됐거나, 공유한 사람이 취소했거나, 주소가 틀렸어요.</p>
      </main>
    );
  return (
    <main className="min-h-dvh bg-surface">
      <SharedReportView data={found.data} expiresAt={found.expiresAt} />
    </main>
  );
}
