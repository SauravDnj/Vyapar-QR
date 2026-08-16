import type { TimeseriesPoint } from '../lib/analytics-api';

const CHART_HEIGHT = 140;

/** Simple dependency-free bar chart, shared by the client analytics page and
 * the super-admin platform-wide analytics page. */
export function TimeseriesChart({ data }: { data: TimeseriesPoint[] }) {
  const max = Math.max(
    1,
    ...data.flatMap((point) => [point.pageViews, point.buttonClicks, point.qrScans]),
  );
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
        {data.map((point) => (
          <div
            key={point.date}
            className="flex flex-1 items-end justify-center gap-0.5"
            title={point.date}
          >
            <div
              className="w-1/3 rounded-t bg-blue-500"
              style={{ height: (point.pageViews / max) * CHART_HEIGHT }}
            />
            <div
              className="w-1/3 rounded-t bg-emerald-500"
              style={{ height: (point.buttonClicks / max) * CHART_HEIGHT }}
            />
            <div
              className="w-1/3 rounded-t bg-amber-500"
              style={{ height: (point.qrScans / max) * CHART_HEIGHT }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map((point, index) => (
          <div key={point.date} className="flex-1 text-center text-[10px] text-muted">
            {index % labelEvery === 0 ? point.date.slice(5) : ''}
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 bg-blue-500" /> Page views
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 bg-emerald-500" /> Button clicks
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 bg-amber-500" /> QR scans
        </span>
      </div>
    </div>
  );
}
