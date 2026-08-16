import type { FunnelStage } from '../lib/analytics-api';

/** Horizontal stage-bar: each stage's bar width is relative to the first
 * (top-of-funnel) stage's count, with a drop-off percentage shown between
 * consecutive stages. */
export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, stages[0]?.count ?? 0);

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1] : null;
        const dropOffPercent = previous && previous.count > 0 ? Math.round(((previous.count - stage.count) / previous.count) * 100) : null;
        const widthPercent = (stage.count / max) * 100;

        return (
          <div key={stage.stage} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stage.stage}</span>
              <span className="text-muted">
                {stage.count}
                {dropOffPercent !== null && dropOffPercent > 0 ? ` (−${String(dropOffPercent)}% from ${previous!.stage})` : ''}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-background">
              <div className="h-3 rounded-full bg-accent" style={{ width: `${String(Math.max(2, widthPercent))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
