import type { Analytics, Bookmark, DocumentResponse, UserProfile, Voice } from '../types';
import { TYPE_STYLES } from './SegmentList';

interface Props {
  doc: DocumentResponse | null;
  user: UserProfile | null;
  analytics: Analytics | null;
  bookmarks: Bookmark[];
  voices: Voice[];
  onSpeedChange: (speed: number) => void;
  onVoiceChange: (voiceId: string) => void;
  onJump: (segmentId: string) => void;
}

const card = 'space-y-3 rounded-2xl border border-lux-border bg-lux-card p-5';
const label = 'text-xs uppercase tracking-wider text-lux-textDim';

export function InsightsPanel({ doc, user, analytics, bookmarks, voices, onSpeedChange, onVoiceChange, onJump }: Props) {
  const offset = analytics?.prosody_offset ?? 0;
  const actions = analytics?.actions ?? {};
  const slowdowns = (actions.slow_down ?? 0) + (actions.too_complex ?? 0);

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={label}>Document</p>
        {doc ? (
          <>
            <p className="text-sm text-lux-text">{doc.stats.segment_count} segments · avg complexity {Math.round(doc.stats.avg_complexity * 100)}%</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(doc.stats.content_types).map(([type, count]) => (
                <span
                  key={type}
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${TYPE_STYLES[type as keyof typeof TYPE_STYLES]}`}
                >
                  {type} {count}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-lux-textMuted">Upload material to see its segment breakdown.</p>
        )}
      </div>

      <div className={card}>
        <p className={label}>Adaptive state</p>
        <p className="text-sm text-lux-text">
          Prosody offset{' '}
          <span className="font-mono text-lux-gold">{offset >= 0 ? '+' : ''}{offset.toFixed(2)}</span>
        </p>
        <p className="text-xs text-lux-textMuted">
          Each “too complex” request slows later dense segments by 5%; each “too slow” request speeds them up. Changes apply to the next segment you play.
        </p>
        <p className="text-xs text-lux-textDim">
          Feedback: {actions.replay ?? 0} replays · {slowdowns} slow-downs · {actions.speed_up ?? 0} speed-ups
        </p>
      </div>

      <div className={card}>
        <p className={label}>Learner settings</p>
        {user && (
          <>
            <label className="block text-sm text-lux-text">
              Base speed <span className="font-mono text-lux-gold">{user.base_speed.toFixed(2)}×</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={user.base_speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="mt-2 w-full accent-[#C8A96B]"
                aria-label="Base speaking speed"
              />
            </label>
            <label className="block text-sm text-lux-text">
              Voice
              <select
                value={user.preferred_voice}
                onChange={(e) => onVoiceChange(e.target.value)}
                className="mt-2 w-full rounded-lg border border-lux-border bg-lux-bg p-2 text-sm"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.locale}, {v.gender})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className={card}>
        <p className={label}>Bookmarks</p>
        {bookmarks.length === 0 ? (
          <p className="text-sm text-lux-textMuted">Bookmark key concepts while listening to see them here.</p>
        ) : (
          <ul className="space-y-2">
            {bookmarks.map((b) => (
              <li key={b.segment_id}>
                <button
                  type="button"
                  onClick={() => onJump(b.segment_id)}
                  className="w-full rounded-lg border border-lux-border p-2 text-left text-xs text-lux-textMuted hover:border-lux-gold"
                >
                  <span className="capitalize text-lux-gold">{b.content_type}</span> · {b.text.slice(0, 90)}
                  {b.text.length > 90 ? '…' : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
