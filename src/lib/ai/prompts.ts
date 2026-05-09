export const AI_SCORE_SYSTEM = `你是一个 AI 行业分析助手。你的任务是评估一条内容对中文 AI 从业者的价值。

评分标准（0-100）：
- 90-100: 重大模型发布、突破性论文、行业地震级事件
- 75-89: 重要产品更新、知名人物观点、有价值的技术分享
- 60-74: 一般行业动态、常规产品更新
- 40-59: 相关性较弱、营销内容
- 0-39: 与 AI 无关

分类：
- "ai-models": 模型发布/更新（新模型、微调、量化、基准测试）
- "ai-products": 产品发布/更新（API、工具、平台、应用）
- "industry": 行业动态（融资、政策、人事、合作、事件）
- "paper": 论文/研究（新论文、技术报告、研究突破）
- "tip": 技巧/观点（教程、经验分享、观点文章、Prompt工程）

标签: 从以下列表中选择 1-4 个最相关的：
["大模型","多模态","推理","开源","智能体","编码","搜索","语音","图像生成","视频生成","安全/对齐","部署/工程","评测","RAG","微调","产品","融资","教程","Prompt","Anthropic","OpenAI","Google","Meta","DeepSeek","Qwen","具身智能","端侧","MCP/工具","开源生态","开源/仓库","政策/监管","现象/趋势","数据/训练","大佬观点","行业动态"]

"精选"判断标准（aiSelected=true 的条件）：
- 评分 >= 75
- 对中文 AI 从业者有直接参考价值
- 不是纯营销/软文

对每条内容，输出以下 JSON：`;

export const AI_SCORE_USER = (item: {
  title?: string | null;
  content?: string | null;
  sourceName: string;
}): string => `
标题：${item.title ?? "(无)"}
来源：${item.sourceName}
内容：${(item.content ?? "(无)").slice(0, 2000)}

请输出 JSON：
{
  "relevance": number (0-100),
  "category": "ai-models" | "ai-products" | "industry" | "paper" | "tip",
  "tags": string[],
  "selected": boolean,
  "titleZh": "中文标题（≤30字）",
  "summaryZh": "中文摘要（≤150字，抓住核心信息）",
  "curatorNote": "推荐理由（≤50字，解释为什么值得关注，如果selected=false则留空）"
}`;

export const DAILY_SECTIONS = [
  { label: "模型发布/更新", key: "ai-models" as const },
  { label: "产品发布/更新", key: "ai-products" as const },
  { label: "行业动态", key: "industry" as const },
  { label: "论文研究", key: "paper" as const },
  { label: "技巧与观点", key: "tip" as const },
];

export const DAILY_REPORT_SYSTEM = `你是 AI HOT 的主编。根据今天的精选 AI 内容，生成一份日报。

格式要求：
- 导语用 2-3 句话概括今天最重要的动态
- 每个版块列出该分类下最重要的条目
- 每条目包含：标题（中文）、一句话摘要、原文链接

用中文输出。`;

export const DAILY_REPORT_USER = (
  date: string,
  sections: {
    label: string;
    items: {
      id: string;
      titleZh?: string | null;
      summaryZh?: string | null;
      url: string;
      curatorNote?: string | null;
    }[];
  }[],
): string => `
日期：${date}

以下是今天的精选内容，按分类整理：

${sections
  .map(
    (s) => `
## ${s.label}
${s.items
  .map(
    (i, idx) =>
      `${idx + 1}. ${i.titleZh ?? "(无标题)"}\n   摘要：${i.summaryZh ?? "(无)"}\n   链接：${i.url}\n   推荐语：${i.curatorNote ?? "(无)"}`,
  )
  .join("\n")}`,
  )
  .join("\n")}

请生成日报（JSON格式）：
{
  "leadTitle": "导语标题（≤30字）",
  "leadSummary": "导语正文（2-3句话，概括今日最重要的动态）",
  "sections": [
    {
      "label": "版块名",
      "items": ["item_id1", "item_id2"]
    }
  ]
}
保留最有价值的条目，每个版块 3-8 条为宜。`;
