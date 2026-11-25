import { useCallback, useEffect, useState } from 'react';
import { InsightsPanel } from './components/InsightsPanel';
import { Player } from './components/Player';
import { SegmentList } from './components/SegmentList';
import { UploadPanel } from './components/UploadPanel';
import { api, errorMessage } from './services/api';
import type { Analytics, Bookmark, DocumentResponse, FeedbackAction, UserProfile, Voice } from './types';

const USER_KEY = 'learner-id';
const USER_ID = (() => {
  const existing = localStorage.getItem(USER_KEY);
  if (existing) return existing;
  const fresh = `learner-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(USER_KEY, fresh);
  return fresh;
})();

export default function App() {
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);
  const [showSsml, setShowSsml] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const segments = doc?.segments ?? [];
  const current = segments[index];
  const bookmarkedIds = new Set(bookmarks.map((b) => b.segment_id));

  const refreshPanels = useCallback(async () => {
    try {
      const [stats, saved] = await Promise.all([api.analytics(USER_ID), api.bookmarks(USER_ID)]);
      setAnalytics(stats);
      setBookmarks(saved.bookmarks);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    api.voices().then((r) => setVoices(r.voices)).catch((e) => setError(errorMessage(e)));
    api.getUser(USER_ID).then((r) => setUser(r.user)).catch((e) => setError(errorMessage(e)));
    refreshPanels();
  }, [refreshPanels]);

  // Keyboard: Space toggles play; arrows move between segments.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('textarea, input, select')) return;
      if (event.code === 'Space' && current) {
        event.preventDefault();
        setPlaying((p) => !p);
      } else if (event.code === 'ArrowRight') {
        setIndex((i) => Math.min(segments.length - 1, i + 1));
      } else if (event.code === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, segments.length]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const handleLoaded = (loaded: DocumentResponse) => {
    setDoc(loaded);
    setIndex(0);
    setPlaying(false);
    setError(null);
    setNotice(`Segmented into ${loaded.stats.segment_count} parts.`);
  };

  const handleAction = async (action: FeedbackAction) => {
    if (!current) return;
    if (action === 'replay') {
      setReplayNonce((n) => n + 1);
      setPlaying(true);
    }
    try {
      const res = await api.feedback(USER_ID, current.segment_id, action);
      setNotice(res.message);
      await refreshPanels();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const changeSpeed = async (speed: number) => {
    try {
      const res = await api.updateUser(USER_ID, { base_speed: speed });
      setUser(res.user);
      setNotice('Speed updated. It applies from the next segment.');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const changeVoice = async (voiceId: string) => {
    try {
      const res = await api.updateUser(USER_ID, { preferred_voice: voiceId });
      setUser(res.user);
      setNotice('Voice updated. It applies from the next segment.');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const jumpTo = (segmentId: string) => {
    const found = segments.findIndex((s) => s.segment_id === segmentId);
    if (found >= 0) setIndex(found);
  };

  return (
    <div className="flex min-h-screen flex-col bg-lux-bg text-lux-text">
      <header className="flex items-center justify-between border-b border-lux-border px-6 py-4">
        <div>
          <h1 className="font-serif text-2xl">Adaptive TTS Learning Assistant</h1>
          <p className="text-xs text-lux-textDim">Context-aware synthesis for study material</p>
        </div>
        {doc && (
          <label className="flex items-center gap-2 text-sm text-lux-textMuted">
            <input type="checkbox" checked={showSsml} onChange={(e) => setShowSsml(e.target.checked)} className="accent-[#C8A96B]" />
            Show SSML
          </label>
        )}
      </header>

      {(error || notice) && (
        <div className="px-6 pt-4">
          {error && (
            <div role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-200">
              {error}{' '}
              <button type="button" className="underline" onClick={() => setError(null)}>dismiss</button>
            </div>
          )}
          {!error && notice && (
            <div role="status" className="rounded-lg border border-lux-gold/40 bg-lux-gold/10 px-4 py-2 text-sm text-lux-champagne">
              {notice}
            </div>
          )}
        </div>
      )}

      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-[320px_1fr_300px]">
        <aside>
          <UploadPanel userId={USER_ID} onLoaded={handleLoaded} onError={setError} />
        </aside>

        <section className="min-w-0">
          {doc ? (
            <SegmentList
              title={doc.document.title}
              segments={segments}
              activeIndex={index}
              bookmarkedIds={bookmarkedIds}
              showSsml={showSsml}
              onSelect={(i) => setIndex(i)}
            />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-lux-border p-10 text-center text-lux-textMuted">
              Upload or paste study material to split it into segments, classify each part and listen with adaptive pacing.
            </div>
          )}
        </section>

        <aside>
          <InsightsPanel
            doc={doc}
            user={user}
            analytics={analytics}
            bookmarks={bookmarks}
            voices={voices}
            onSpeedChange={changeSpeed}
            onVoiceChange={changeVoice}
            onJump={jumpTo}
          />
        </aside>
      </main>

      {doc && current && (
        <footer className="sticky bottom-0 border-t border-lux-border bg-lux-secondary/95 backdrop-blur">
          <Player
            segment={current}
            nextSegment={segments[index + 1]}
            hasPrevious={index > 0}
            userId={USER_ID}
            playing={playing}
            replayNonce={replayNonce}
            bookmarked={bookmarkedIds.has(current.segment_id)}
            onPlayingChange={setPlaying}
            onNext={() => setIndex((i) => Math.min(segments.length - 1, i + 1))}
            onPrevious={() => setIndex((i) => Math.max(0, i - 1))}
            onAction={handleAction}
            onError={setError}
          />
        </footer>
      )}
    </div>
  );
}
