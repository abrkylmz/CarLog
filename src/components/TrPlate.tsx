/** A Turkish number plate: white plate, black frame and the blue "TR" band on the left. */
export default function TrPlate({ plate, size = "md" }: { plate: string; size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <span
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded border-slate-900 bg-white font-mono font-bold leading-none text-slate-900 shadow-sm ${
        sm ? "border text-[11px]" : "border-2 text-sm"
      }`}
      aria-label={`Plaka ${plate}`}
    >
      <span
        aria-hidden
        className={`flex items-end justify-center bg-[#003399] font-sans font-bold text-white ${
          sm ? "px-0.5 pb-px text-[7px]" : "px-1 pb-0.5 text-[9px]"
        }`}
      >
        TR
      </span>
      <span className={`whitespace-nowrap tracking-wider ${sm ? "px-1.5 py-0.5" : "px-2 py-1"}`}>{plate}</span>
    </span>
  );
}
