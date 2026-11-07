import { runAll } from "../lib/multiverse";
import { DEMOS } from "../lib/demo";
import { getWorld } from "../lib/worlds";
const w = getWorld("civil-servant");
const paths = runAll(DEMOS.developer.profile, w, 36, "2026-12", undefined, 30);
for (const p of paths.slice(0, 30)) {
  const ev = p.months.filter((m) => m.event).map((m) => `${m.month}:${m.event!.id}[${m.event!.branchLabel ?? ""}]${m.salary > 0 ? "$" : ""}`);
  if (ev.some((x) => x.includes("exam-fail"))) { console.log(ev.join(" ")); break; }
}
