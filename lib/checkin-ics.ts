// 체크인 날을 달력에 넣는 .ics 파일(리포트·체크인 화면 같이 씀)
export function downloadCheckin(days = 30) {
  const d = new Date(Date.now() + Math.max(1, days) * 24 * 3600 * 1000);
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//career-rehearsal//KO",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@career-rehearsal`,
    `DTSTART;VALUE=DATE:${ymd}`,
    "SUMMARY:If:Life 체크인",
    "DESCRIPTION:한 달 동안 해 본 일을 입력하고 다시 살아보세요.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "진로-체크인.ics";
  a.click();
  URL.revokeObjectURL(url);
}
