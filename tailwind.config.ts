import type { Config } from "tailwindcss";

// 디자인 토큰. 색은 '노선' 색만 쓰고 나머지는 무채색으로 둔다.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#F4F5F7", // 바탕
        surface: "#FFFFFF", // 카드
        ink: "#14171F", // 본문, 주요 버튼
        muted: "#5B6472", // 보조 글자(흰 바탕 대비 5.9:1)
        hair: "#E3E6EB", // 테두리
        lineA: "#2F5BEA",
        lineB: "#F26B1D",
        lineC: "#13A57B",
        lineD: "#7B4DDB",
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "system-ui", "sans-serif"],
      },
      fontSize: {
        // 본문 기준 16px, 1.25배 단계
        cap: ["12px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.55" }],
        base: ["16px", { lineHeight: "1.6" }],
        lg: ["18px", { lineHeight: "1.5" }],
        xl: ["22px", { lineHeight: "1.35", letterSpacing: "-0.02em" }],
        "2xl": ["28px", { lineHeight: "1.25", letterSpacing: "-0.03em" }],
        "3xl": ["36px", { lineHeight: "1.15", letterSpacing: "-0.035em" }],
        "4xl": ["48px", { lineHeight: "1.08", letterSpacing: "-0.04em" }],
      },
      borderRadius: { card: "18px" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        draw: { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        dash: { from: { strokeDashoffset: "var(--len)" }, to: { strokeDashoffset: "0" } },
        blink: { "0%,80%,100%": { opacity: "0.25" }, "40%": { opacity: "1" } },
      },
      animation: {
        rise: "rise 320ms cubic-bezier(.2,.7,.2,1) both",
        draw: "draw 600ms cubic-bezier(.2,.7,.2,1) both",
        blink: "blink 1.2s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
