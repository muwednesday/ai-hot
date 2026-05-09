export function DateHeader({ date }: { date: string }) {
  return (
    <div className="sticky top-12 z-10 bg-background/90 backdrop-blur-sm py-2 -mx-4 px-4 border-b border-border/30">
      <h2 className="text-sm font-semibold text-muted-foreground">{date}</h2>
    </div>
  );
}
