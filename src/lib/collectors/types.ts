export interface RawItem {
  sourceId: string;
  title: string | null;
  url: string;
  content: string | null;
  publishedAt: Date;
  imageUrls: string[];
  metadata?: Record<string, unknown>;
}

export interface CollectorResult {
  sourceName: string;
  total: number;
  newItems: number;
  errors: string[];
}
