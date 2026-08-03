// 请求类型路由 slug 映射
export type PathCode = "A" | "B" | "C" | "D";

export const TYPE_SLUG_MAP: Record<string, PathCode> = {
  "narrate-then-request": "A",
  "discuss-then-request": "B",
  "request-then-narrate": "C",
  "chained-request": "D",
};

export const TYPE_SLUG_REVERSE: Record<PathCode, string> = {
  A: "narrate-then-request",
  B: "discuss-then-request",
  C: "request-then-narrate",
  D: "chained-request",
};

export const TYPE_ORDER: PathCode[] = ["A", "B", "C", "D"];

export const TYPE_ACCENTS: Record<PathCode, string> = {
  A: "var(--blue)",
  B: "var(--gold)",
  C: "var(--green)",
  D: "var(--red)",
};
