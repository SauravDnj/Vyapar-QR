export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[28px] border-4 border-border-color bg-background"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex justify-center border-b border-border-color bg-surface py-2">
        <div className="h-1 w-16 rounded-full bg-border-color" />
      </div>
      <div className="max-h-[600px] overflow-y-auto">{children}</div>
    </div>
  );
}
