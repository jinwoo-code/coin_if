// GitHub 공개 저장소로 프로젝트 경험을 가늠한다(로그인 필요 없음, 공개 정보만).
import { NextResponse } from "next/server";

interface Repo {
  fork: boolean;
  language: string | null;
  pushed_at: string;
  stargazers_count: number;
  size: number;
}

export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get("user")?.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").split("/")[0];
  if (!user || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user)) return NextResponse.json({ error: "GitHub 아이디를 확인해 주세요." }, { status: 400 });
  try {
    const res = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 3600 } });
    if (res.status === 404) return NextResponse.json({ error: "없는 아이디예요." }, { status: 404 });
    if (!res.ok) throw new Error(String(res.status));
    const repos = ((await res.json()) as Repo[]).filter((r) => !r.fork);
    const real = repos.filter((r) => r.size > 50); // 거의 빈 저장소는 빼고
    const yearAgo = Date.now() - 365 * 24 * 3600 * 1000;
    const recent = real.filter((r) => new Date(r.pushed_at).getTime() > yearAgo).length;
    const langs = Object.entries(real.reduce<Record<string, number>>((acc, r) => (r.language ? { ...acc, [r.language]: (acc[r.language] ?? 0) + 1 } : acc), {}))
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([l]) => l);
    return NextResponse.json({
      user,
      repos: real.length,
      recent,
      langs,
      projects: Math.min(5, real.length),
      // 최근 1년 활동이 많을수록 높게(대략값)
      codingLevel: real.length === 0 ? 0 : recent >= 4 ? 2 : 1,
    });
  } catch {
    return NextResponse.json({ error: "GitHub에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 502 });
  }
}
