export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-32 animate-pulse rounded-2xl bg-fill-strong/60" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-fill-strong/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="h-96 animate-pulse rounded-2xl bg-fill-strong/60 xl:col-span-2" />
        <div className="h-96 animate-pulse rounded-2xl bg-fill-strong/60" />
      </div>
    </div>
  );
}
