import { motion } from 'framer-motion';

export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  /** e.g. "+42" or "-3" — sign determines color, omit for no delta. */
  delta?: string;
}) {
  const deltaIsPositive = delta?.startsWith('+');
  const deltaIsNegative = delta?.startsWith('-');

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="flex flex-col gap-1 rounded-lg border border-border-color bg-surface p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
        {delta ? (
          <span
            className={`font-mono text-xs ${deltaIsPositive ? 'text-success' : deltaIsNegative ? 'text-danger' : 'text-muted'}`}
          >
            {deltaIsPositive ? '▲' : deltaIsNegative ? '▼' : ''} {delta}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
