// 정밀: 인생 이야기 한 장 끝까지. 꼬리 질문 → 넘어가기 → 새로고침 뒤 이어서 → '맞나요?' → 저장.
import { expect, test } from "@playwright/test";
import { EMPTY, mockStoryApis, savedProfile, watchOtherPosts } from "./helpers";

const SECRET = "초록색자전거를고친날";

test("인생 이야기 한 장", async ({ page }) => {
  await mockStoryApis(page, { ...EMPTY, regretType: { value: "inaction", evidence: `${SECRET} 미술을 포기한 게 후회돼요` } });
  const others = watchOtherPosts(page);
  // 검사를 마친 사람처럼 프로필만 넣어 둔다
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("cr:v10:profile", JSON.stringify({ name: "테스트", major: "경영학과" })));
  await page.goto("/story");
  await expect(page.getByText("0/6장 끝냄")).toBeVisible();
  await page.getByRole("link", { name: /큰 결정과 후회/ }).click();

  const answer = page.getByPlaceholder("생각나는 대로 써 주세요");
  const send = page.getByRole("button", { name: "보내기" });
  await answer.fill(`${SECRET} 인문계에서 자연계로 바꾼 게 제일 큰 결정이에요`);
  await send.click();
  await expect(page.getByText("그때 어떤 기분이었어요?")).toBeVisible(); // 꼬리 질문(가짜)
  await page.getByRole("button", { name: "넘어가기" }).click();
  await expect(page.getByText("가장 후회하는 선택이 있어요?")).toBeVisible();

  // 나갔다 와도 이어서
  await page.reload();
  await expect(page.getByText("넘어갈게요")).toBeVisible();
  await answer.fill(`${SECRET} 미술을 포기한 게 후회돼요. 지금도 가끔 그림을 그려요`);
  await send.click();
  await expect(page.getByText("그때 어떤 기분이었어요?")).toHaveCount(2);
  await answer.fill("아쉬웠지만 어쩔 수 없다고 생각했어요");
  await send.click(); // 꼬리 질문 뒤에는 가짜 API가 null → 시작 질문이 끝나서 '맞나요?'

  await page.getByRole("button", { name: "맞아요, 이대로 저장" }).click();
  await expect(page).toHaveURL(/\/story$/);
  await expect(page.getByText("1/6장 끝냄")).toBeVisible();

  const p = await savedProfile(page);
  expect(p.storyRaw.decisions.done).toBe("1");
  expect(p.story.regretType.value).toBe("inaction");
  expect(others.filter((b) => b.includes(SECRET)).map((b) => b.split(" ")[0])).toEqual([]);

  // 끝낸 장 다시 하기: 쓴 글만 지우고 처음부터. 확인한 값은 다시 확인할 때까지 남는다
  await page.getByRole("button", { name: /큰 결정과 후회 다시 하기/ }).click();
  await page.getByRole("button", { name: "지우고 다시 하기" }).click();
  await expect(page).toHaveURL(/\/story\/decisions/);
  const q = await savedProfile(page);
  expect(q.storyRaw.decisions).toBeUndefined();
  expect(q.story.regretType.value).toBe("inaction");
});
