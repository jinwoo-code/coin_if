// 대화 말풍선(검사 인터뷰, 인생 이야기)
export function Ai({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-rise items-end gap-2.5">
      <span aria-hidden="true" className="mb-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
        AI
      </span>
      <div className="max-w-[85%] rounded-[20px] rounded-bl-md bg-surface px-4 py-3 text-base shadow-[0_0_0_1px_#E3E6EB]">{children}</div>
    </div>
  );
}

export function Me({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[85%] animate-rise self-end rounded-[20px] rounded-br-md bg-ink px-4 py-3 text-base text-white">{children}</div>;
}
