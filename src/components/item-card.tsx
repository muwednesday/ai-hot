import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ItemCardProps {
  item: {
    id: string;
    title?: string | null;
    titleZh?: string | null;
    summaryZh?: string | null;
    curatorNote?: string | null;
    url: string;
    publishedAt: Date;
    hotScore: number;
    aiRelevance?: number | null;
    aiCategory?: string | null;
    aiTags: string[];
    aiSelected: boolean;
    source: { name: string };
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  "ai-models": "模型发布",
  "ai-products": "产品更新",
  industry: "行业动态",
  paper: "论文研究",
  tip: "技巧观点",
};

export function ItemCard({ item }: ItemCardProps) {
  const time = new Date(item.publishedAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });

  return (
    <Card
      className={`p-4 transition-all duration-300 hover:translate-y-[-1px] rounded-xl ${
        item.aiSelected
          ? "border-l-2 border-l-primary border-border/50 bg-card/80"
          : "border-border/50 bg-card/50"
      } hover:border-primary/30`}
    >
      {/* Header: time + source + featured badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {time}
          </span>
          <span className="text-sm font-medium">{item.source.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.aiSelected && (
            <Badge
              variant="outline"
              className="text-xs font-medium border-featured/30 text-featured bg-featured/5"
            >
              精选 {item.aiRelevance}
            </Badge>
          )}
          {!item.aiSelected && item.aiRelevance != null && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {item.aiRelevance}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <Link
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-semibold leading-relaxed hover:text-primary transition-colors line-clamp-4 block mb-2"
      >
        {item.titleZh ?? item.title ?? "(无标题)"}
      </Link>

      {/* Summary */}
      {item.summaryZh && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-2">
          {item.summaryZh}
        </p>
      )}

      {/* Tags */}
      {item.aiTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.aiTags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {item.aiCategory && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {CATEGORY_LABELS[item.aiCategory] ?? item.aiCategory}
            </Badge>
          )}
        </div>
      )}

      {/* Curator note */}
      {item.curatorNote && (
        <>
          <Separator className="my-2.5 bg-border/30" />
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            💡 {item.curatorNote}
          </p>
        </>
      )}
    </Card>
  );
}
