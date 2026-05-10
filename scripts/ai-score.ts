import { config } from "dotenv";
config({ path: ".env.local", override: true });

(async () => {
  const { processUnscoredItems } = await import("../src/lib/ai/pipeline");
  let t = 0, s = 0;
  while (true) {
    const r = await processUnscoredItems(10);
    if (r.processed === 0) break;
    t += r.processed;
    s += r.selected;
  }
  if (t > 0) console.log(`评分: ${t}条 精选: ${s}`);
  else console.log("无待评分数据");
})();
