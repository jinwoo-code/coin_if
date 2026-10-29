// 한국어 조사 붙이기: 받침 유무에 따라 '이/가', '으로/로' 등을 고른다.
function lastBatchim(word: string): number | null {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return code % 28; // 0이면 받침 없음, 8이면 ㄹ 받침
}

export function iGa(word: string) {
  const b = lastBatchim(word);
  return word + (b === null || b === 0 ? "가" : "이");
}

export function euro(word: string) {
  const b = lastBatchim(word);
  return word + (b === null || b === 0 || b === 8 ? "로" : "으로");
}

export function eulReul(word: string) {
  const b = lastBatchim(word);
  return word + (b === null || b === 0 ? "를" : "을");
}

// 따옴표로 감싼 단어 뒤에 조사: quoted("퇴사함", eulReul) → "'퇴사함'을"
export function quoted(word: string, josa: (w: string) => string) {
  return `'${word}'${josa(word).slice(word.length)}`;
}

export function waGwa(word: string) {
  const b = lastBatchim(word);
  return word + (b === null || b === 0 ? "와" : "과");
}
