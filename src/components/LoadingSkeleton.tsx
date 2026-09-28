/** Placeholder shapes shown while the garage loads: stat tiles and two vehicle cards. */
export default function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-3 h-6 w-24" />
            <div className="skeleton mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="skeleton mb-3 h-4 w-24" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-t-4 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10" />
              <div className="flex-1">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton mt-2 h-3 w-40" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((j) => (
                <div key={j}>
                  <div className="skeleton h-2.5 w-12" />
                  <div className="skeleton mt-2 h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
