import Link from "next/link";
import { MascotFace } from "@/components/mascot";

// 없는 주소: 갈래가 길을 잃은 화면.
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center gap-4 px-5 text-center">
      <MascotFace mood="dizzy" size={96} />
      <h1 className="text-xl font-bold">앗, 이 길은 지도에 없어요</h1>
      <p className="text-sm text-muted">주소가 바뀌었거나 사라진 화면이에요.</p>
      <Link href="/" className="btn-primary">
        처음으로
      </Link>
    </main>
  );
}
