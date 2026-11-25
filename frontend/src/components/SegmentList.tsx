import { useEffect } from 'react';
import type { ContentType, Segment } from '../types';

export const TYPE_STYLES: Record<ContentType, string> = {
  definition: 'text-lux-champagne border-lux-gold/50 bg-lux-gold/10',
  formula: 'text-sky-200 border-sky-400/40 bg-sky-400/10',
  code: 'text-emerald-200 border-emerald-400/40 bg-emerald-400/10',
  example: 'text-violet-200 border-violet-400/40 bg-violet-400/10',
  summary: 'text-amber-100 border-amber-200/40 bg-amber-200/10',
  narrative: 'text-lux-textMuted border-lux-borderLight bg-lux-surface',
};

interface Props {
  title: string;
  segments: Segment[];
  activeIndex: number;
  bookmarkedIds: Set<string>;
  showSsml: boolean;
  onSelect: (index: number) => void;
}

export function SegmentList({ title, segments, activeIndex, bookmarkedIds, showSsml, onSelect }: Props) {
  useEffect(() => {
    document.getElementById(`segment-${activeIndex}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl text-lux-text">{title}</h2>
        <p className="text-sm text-lux-textMuted">{segments.length} segments · click any segment to play from there</p>
      </div>
      <ol className="space-y-3" aria-label="Document segments">
        {segments.map((seg, i) => {
          const active = i === activeIndex;
          return (
            <li key={seg.segment_id} id={`segment-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? 'true' : undefined}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active ? 'border-lux-gold bg-lux-elevated shadow-gold-glow-sm' : 'border-lux-border bg-lux-card hover:border-lux-borderLight'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-lux-textDim">#{seg.sequence_order}</span>
                  <span className={`rounded-full border px-2 py-0.5 capitalize ${TYPE_STYLES[seg.content_type]}`}>
                    {seg.content_type}
                  </span>
                  <span className="flex items-center gap-1.5 text-lux-textDim">
                    complexity
                    <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-lux-border">
                      <span className="block h-full bg-lux-gold" style={{ width: `${Math.round(seg.complexity_score * 100)}%` }} />
                    </span>
                    {Math.round(seg.complexity_score * 100)}%
                  </span>
                  <span className="text-lux-textDim">{seg.word_count} words</span>
                  {bookmarkedIds.has(seg.segment_id) && <span className="text-lux-gold">★ bookmarked</span>}
                </div>
                <p className="text-sm leading-relaxed text-lux-text">{seg.text}</p>
                {showSsml && (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-lux-bg p-3 text-xs text-lux-textMuted">
                    {seg.generated_ssml}
                  </pre>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
