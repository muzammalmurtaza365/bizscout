interface Props {
  connected: boolean;
}

export function ConnectionIndicator({ connected }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        }`}
        aria-hidden="true"
      />
      <span className={connected ? 'text-emerald-700' : 'text-slate-500'}>
        {connected ? 'Live' : 'Disconnected'}
      </span>
    </span>
  );
}
