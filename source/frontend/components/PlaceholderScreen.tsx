interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--bg-primary)] p-8">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-center text-[var(--text-secondary)]">{subtitle}</p>
      )}
    </div>
  );
}
