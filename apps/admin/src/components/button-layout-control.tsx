'use client';

import { BUTTON_COLUMN_CHOICES, BUTTON_SIZE_CHOICES, buttonGrid } from '@vyaparqr/types';

import type { ButtonColumns, ButtonSize } from '@vyaparqr/types';

const COLUMN_LABEL: Record<ButtonColumns, string> = { auto: 'Auto', '2': '2', '3': '3', '4': '4' };
const SIZE_LABEL: Record<ButtonSize, string> = { auto: 'Auto', small: 'Small', medium: 'Medium', large: 'Large' };

/**
 * Chooses how the landing page lays out its action buttons.
 *
 * Both settings default to Auto. Whatever is chosen, the line underneath says
 * what the page will actually draw for this business's buttons — using the
 * same buttonGrid() the page uses — including when a chosen column count has
 * been widened because it would have needed more rows than the screen has.
 */
export function ButtonLayoutControl({
  count,
  columns,
  size,
  saving,
  onChange,
}: {
  count: number;
  columns: ButtonColumns;
  size: ButtonSize;
  saving: boolean;
  onChange: (next: { columns: ButtonColumns; size: ButtonSize }) => void;
}) {
  const grid = buttonGrid(count, columns);
  const auto = buttonGrid(count, 'auto');

  return (
    <div className="flex flex-col gap-4 text-sm">
      <Segmented
        label="Buttons per row"
        options={BUTTON_COLUMN_CHOICES}
        labels={COLUMN_LABEL}
        value={columns}
        disabled={saving}
        onSelect={(value) => {
          onChange({ columns: value, size });
        }}
      />
      <Segmented
        label="Button size"
        options={BUTTON_SIZE_CHOICES}
        labels={SIZE_LABEL}
        value={size}
        disabled={saving}
        onSelect={(value) => {
          onChange({ columns, size: value });
        }}
      />

      <div className="flex items-start gap-4 rounded-md border border-border-color p-3">
        <GridDiagram cols={grid.cols} count={count} />
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {count === 0 ? 'No buttons yet' : `${String(count)} button${count === 1 ? '' : 's'} → ${String(grid.cols)} × ${String(grid.rows)}`}
          </p>
          <p className="text-xs text-text-muted">
            {columns === 'auto'
              ? 'Auto picks the fewest columns that keep the grid even, so buttons stay as big as possible.'
              : `Auto would use ${String(auto.cols)} × ${String(auto.rows)}.`}
          </p>
          {grid.widened ? (
            <p className="text-xs text-warning">
              {columns} per row would need more than 3 rows, which doesn’t fit on a phone, so {String(grid.cols)} are used.
            </p>
          ) : null}
          {grid.lastRowCount > 0 ? <p className="text-xs text-text-muted">The last row is centred.</p> : null}
          {saving ? <p className="text-xs text-text-muted">Saving…</p> : null}
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  labels,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  disabled: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex w-fit overflow-hidden rounded-md border border-border-color">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            onClick={() => {
              if (option !== value) onSelect(option);
            }}
            className={`min-h-9 cursor-pointer border-l border-border-color px-3.5 text-xs first:border-l-0 disabled:opacity-60 ${value === option ? 'bg-accent font-medium text-accent-foreground' : ''}`}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A thumbnail of the grid, last row centred the same way the page does it. */
function GridDiagram({ cols, count }: { cols: number; count: number }) {
  const rows = Math.max(1, Math.ceil(count / cols));
  const last = count % cols;
  const cell = 12;
  const gap = 3;
  const width = cols * cell + (cols - 1) * gap;
  const height = rows * cell + (rows - 1) * gap;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${String(width)} ${String(height)}`} aria-hidden="true" className="mt-0.5 shrink-0">
      {Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / cols);
        const inLastPartial = last > 0 && row === rows - 1;
        const col = i % cols;
        const offset = inLastPartial ? ((cols - last) * (cell + gap)) / 2 : 0;
        return (
          <rect
            key={i}
            x={offset + col * (cell + gap)}
            y={row * (cell + gap)}
            width={cell}
            height={cell}
            rx={3}
            className="fill-accent/70"
          />
        );
      })}
    </svg>
  );
}
