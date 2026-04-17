interface Props {
  status: number;
  ok: boolean;
}

export function StatusBadge({ status, ok }: Props) {
  const color = ok
    ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
    : status === 0
      ? 'bg-slate-100 text-slate-700 ring-slate-200'
      : status >= 500
        ? 'bg-red-100 text-red-700 ring-red-200'
        : 'bg-amber-100 text-amber-700 ring-amber-200';

  const label = status === 0 ? 'ERR' : status;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}
    >
      {label}
    </span>
  );
}
