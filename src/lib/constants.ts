export const CATEGORIES = [
  { slug: null, label: "全部" },
  { slug: "ai-models", label: "模型" },
  { slug: "ai-products", label: "产品" },
  { slug: "industry", label: "行业" },
  { slug: "paper", label: "论文" },
  { slug: "tip", label: "技巧" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupByDate(items: any[]) {
  const map: Record<string, any[]> = {};
  for (const item of items) {
    const date = new Date(item.publishedAt).toLocaleDateString("zh-CN", {
      month: "long",
      day: "numeric",
      timeZone: "Asia/Shanghai",
    });
    if (!map[date]) map[date] = [];
    map[date].push(item);
  }
  return map;
}
