import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// 개발 서버 실행 중에도 프로덕션 빌드가 개발 캐시를 덮어쓰지 않도록 분리한다.
/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});
export default nextConfig;
