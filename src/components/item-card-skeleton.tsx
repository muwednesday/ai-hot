import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ItemCardSkeleton() {
  return (
    <Card className="p-4 rounded-xl border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-16 ml-auto rounded-full" />
      </div>
      <Skeleton className="h-5 w-full mb-1.5" />
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3 mb-2" />
      <div className="flex gap-1 mt-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </Card>
  );
}
