export function PercentDisplay({ value }: { value: number }) {
  const color = value >= 0 ? "text-gain" : "text-loss";
  return (
    <span className={`font-mono ${color}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}
