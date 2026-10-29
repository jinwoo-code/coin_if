import type { Metadata, Viewport } from "next";
// 폰트를 앱 안에 직접 넣는다(인터넷이 막혀도 같은 글꼴로 보이게).
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 진로 리허설",
  description: "가보기 전에 먼저 살아보는 체험형 AI 진로 컨설팅",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F4F5F7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
