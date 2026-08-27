export function PublicationBlockers({ blockers = [] }) {
  if (!blockers.length) {
    return (
      <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
        No critical publication blockers detected. Human editorial approval is
        still required.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {blockers.slice(0, 5).map((blocker, index) => (
        <div
          key={`${blocker.code}-${blocker.claimId || index}`}
          className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs text-rose-100"
        >
          <p className="font-black">{blocker.code}</p>
          <p className="mt-1 leading-5 text-rose-100/80">{blocker.message}</p>
        </div>
      ))}
    </div>
  );
}
