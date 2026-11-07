// 진로 색을 '글자'로 쓸 때만 쓰는 어두운 버전. 진로 색 자체(선·배지·막대)는 그대로 두고,
// 회색 바탕(#F4F5F7)에서도 대비 4.5:1이 될 때까지 같은 색상을 조금씩 어둡게 한다.
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const cache = new Map<string, string>();
export function textColor(hex: string, bg = "#F4F5F7") {
  const key = `${hex}|${bg}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let c = hex;
  for (let k = 1; contrast(c, bg) < 4.5 && k > 0.2; k -= 0.04) {
    c = "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
  }
  cache.set(key, c);
  return c;
}
