// 이력서(PDF 또는 붙여 넣은 글) → 스펙 자동 입력. 사용자는 결과를 확인하고 고치기만 하면 된다.
// AI 키가 없으면 정규식으로 학점·토익·자격증 정도만 뽑는다.
import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/llm";
import type { CertId, Spec } from "@/lib/types";
import { WORLDS } from "@/lib/worlds";

// 우리가 아는 자격증 이름(진로 목록에서 모음). AI가 없을 때 이 이름들만 찾는다.
const CERTS: CertId[] = Array.from(new Set([...WORLDS.flatMap((w) => w.certs), "컴활1급", "컴활2급", "한국사1급", "한국사2급", "운전면허"]));

async function pdfText(buf: ArrayBuffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

function regexSpec(t: string): Partial<Spec> {
  const out: Partial<Spec> = {};
  const gpa = t.match(/(\d\.\d{1,2})\s*\/\s*4\.5/);
  if (gpa) out.gpa = Number(gpa[1]);
  const toeic = t.match(/(?:토익|TOEIC)[^\d]{0,10}(\d{3})/i);
  if (toeic) out.toeic = Number(toeic[1]);
  const flat = t.replace(/\s/g, "");
  const certs: CertId[] = CERTS.filter((c) => flat.includes(c));
  if (/한국사능력검정[^\n]{0,10}1급/.test(t)) certs.push("한국사1급");
  if (/한국사능력검정[^\n]{0,10}2급/.test(t)) certs.push("한국사2급");
  if (/컴퓨터활용능력\s*1급/.test(t)) certs.push("컴활1급");
  out.certs = Array.from(new Set(certs));
  out.projects = Math.min(5, (t.match(/프로젝트/g) ?? []).length);
  const intern = t.match(/인턴[^\n]{0,20}?(\d{1,2})\s*개월/);
  if (intern) out.internMonths = Number(intern[1]);
  out.school = /대학원|석사/.test(t) ? "대학원" : /전문대|과학기술대|폴리텍|\d년제\s*\(2|2년제/.test(t) ? "전문대" : /대학교/.test(t) ? "4년제" : undefined;
  if (!out.school) delete out.school;
  return out;
}

export async function POST(req: Request) {
  let text = "";
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file instanceof File) text = file.type === "application/pdf" || file.name.endsWith(".pdf") ? await pdfText(await file.arrayBuffer()) : await file.text();
    } else {
      text = ((await req.json()) as { text: string }).text ?? "";
    }
  } catch (err) {
    console.error("[이력서 읽기 실패]", err);
    return NextResponse.json({ error: "파일을 읽지 못했어요. PDF가 이미지로만 되어 있으면 글자를 복사해서 붙여 넣어 주세요." }, { status: 400 });
  }
  if (text.trim().length < 20) return NextResponse.json({ error: "읽을 수 있는 글자가 거의 없어요. 글자를 복사해서 붙여 넣어 주세요." }, { status: 400 });

  const spec = await generateJSON<Partial<Spec> & { experiences?: string }>({
    tag: "resume",
    model: "fast",
    system: "너는 이력서에서 사실만 뽑아내는 도우미다. 적혀 있지 않은 건 null로 둔다. 추측하지 않는다.",
    prompt:
      `이력서:\n${text.slice(0, 6000)}\n\nJSON으로 답해라:\n` +
      `{"school":"고졸|전문대|4년제|대학원","status":"재학|졸업예정|졸업","gpa":4.5만점 숫자 또는 null,` +
      `"certs":[이력서에 적힌 자격증·면허 이름 전부, 짧게],"toeic":숫자 또는 null,"projects":끝까지 해 본 프로젝트·작품·실습 수,` +
      `"workMonths":근로·알바 개월 합,"internMonths":인턴·현장실습 개월,"awards":수상 횟수,` +
      `"experiences":가장 중요한 경험 2~3개를 한 문장으로}`,
    fallback: () => regexSpec(text),
  });
  return NextResponse.json({ spec, chars: text.length });
}
