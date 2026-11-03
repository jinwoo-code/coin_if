// 인생 이야기 장에서 답 하나에 꼬리 질문 하나. 처리만 하고 원문은 저장하지도, 로그에 남기지도 않는다.
// 규칙(docs/검사-설계-근거.md '발표 후 할 일'): 한 번에 하나만, 짧게 답하면 더 묻지 않음, 상처·트라우마·건강은 캐묻지 않음, 위기 표현이면 묻지 않고 안내.
import { NextResponse } from "next/server";
import { CHAPTERS, MAX_FOLLOWS } from "@/lib/chapters";
import { hasCrisis } from "@/lib/crisis";
import { generateJSON } from "@/lib/llm";

const SHORT = 20; // 이보다 짧은 답이면 더 묻지 않는다(자)

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { chapter?: string; thread?: { q: string; a: string }[]; follows?: number } | null;
  const ch = CHAPTERS.find((c) => c.id === body?.chapter);
  const thread = (body?.thread ?? []).filter((x) => x && typeof x.q === "string" && typeof x.a === "string").slice(-3);
  const last = thread.at(-1)?.a.trim() ?? "";
  if (!ch || !thread.length) return NextResponse.json({ error: "답이 없어요" }, { status: 400 });
  const crisis = hasCrisis(thread.map((x) => x.a).join(" "));
  if (crisis || (body?.follows ?? 0) >= MAX_FOLLOWS || last.length < SHORT) return NextResponse.json({ q: null, crisis });

  const raw = await generateJSON<{ q?: unknown }>({
    tag: "story followup",
    model: "fast",
    system:
      "너는 대학생의 진로 이야기를 듣는 상담자다. 학생의 마지막 답을 듣고 꼬리 질문을 딱 하나만 한다. " +
      "구체적인 장면, 그때 왜 그렇게 했는지, 그 뒤에 어떻게 됐는지를 묻는다. 학생이 쓴 말을 짧게 받아서 묻는다. " +
      "상처·트라우마·건강·가족 갈등의 아픈 부분은 캐묻지 않는다. 이미 충분히 구체적이면 묻지 않는다(null). " +
      "짧은 한국어 존댓말 한 문장, 40자 이내, 물음표로 끝낸다.",
    prompt: `장: ${ch.title}\n${thread
      .map((x) => `Q. ${x.q}\nA. ${x.a.trim()}`)
      .join("\n")
      .slice(0, 3000)}\n\nJSON으로 답해라: {"q": 꼬리 질문 또는 null}`,
    fallback: () => ({ q: null }), // 키가 없으면 꼬리 질문 없이 다음 질문으로
  });
  const q = typeof raw?.q === "string" ? raw.q.trim() : "";
  return NextResponse.json({ q: q && q.length <= 80 && /[?？]$/.test(q) ? q : null, crisis });
}
