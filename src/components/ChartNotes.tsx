import { NOTE } from "../lib/chartColors";
import type { ChartNote } from "../lib/chartNotes";

/**
 * For a recharts `<LabelList content={…}>` on the top bar: a small dot above each bar that has a
 * note, in the note's color, stacked when a month has two.
 */
export function noteMarks(notes: ChartNote[]) {
  return function Mark(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) {
    const mine = notes.filter((n) => n.index === props.index);
    if (!mine.length) return null;
    const cx = Number(props.x) + Number(props.width) / 2;
    const top = Number(props.y);
    return (
      <g aria-hidden>
        {mine.map((n, i) => (
          <circle key={n.kind} cx={cx} cy={top - 7 - i * 10} r={3.5} strokeWidth={1.5} className={`${NOTE[n.kind].fill} stroke-white dark:stroke-slate-900`} />
        ))}
      </g>
    );
  };
}

/** The same notes spelled out under the chart, with the dot that marks them. */
export function NoteList({ notes }: { notes: ChartNote[] }) {
  if (!notes.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300" aria-label="Grafikte işaretli aylar">
      {notes.map((n) => (
        <li key={n.kind} className="flex items-start gap-2">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${NOTE[n.kind].bg}`} />
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}
