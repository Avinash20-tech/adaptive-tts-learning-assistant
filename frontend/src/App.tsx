
import { useCallback, useEffect, useState } from 'react';
import { InsightsPanel } from './components/InsightsPanel';
import { Player } from './components/Player';
import { SegmentList } from './components/SegmentList';
import { UploadPanel } from './components/UploadPanel';
import { api, errorMessage } from './services/api';
import type {
  Analytics,
  Bookmark,
  DocumentResponse,
  FeedbackAction,
  UserProfile,
  Voice
} from './types';

const USER_KEY = 'learner-id';

const USER_ID = (() => {
  const existing = localStorage.getItem(USER_KEY);
  if (existing) return existing;
  const fresh = `learner-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(USER_KEY, fresh);
  return fresh;
})();

type Page = 'home' | 'text' | 'document' | 'voice' | 'insights';

export default function App() {
  const [page, setPage] = useState<Page>('home');
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
      const [stats, saved] = await Promise.all([
        api.analytics(USER_ID),
        api.bookmarks(USER_ID)
      ]);
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
    setPage('text');
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
    if (found >= 0) {
      setIndex(found);
      setPage('text');
    }
  };

  const navItems: { id: Page; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'text', label: 'Text Studio' },
    { id: 'document', label: 'Document Studio' },
    { id: 'voice', label: 'Voice Atelier' },
    { id: 'insights', label: 'Learning Insights' }
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-[#F4EFE5]">
      <header className="sticky top-0 z-30 border-b border-[#C8A96B]/20 bg-[#080808]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <button onClick={() => setPage('home')} className="text-left">
            <div className="font-serif text-xl tracking-[0.16em] text-[#D9BD83]">
              AURELIA
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#918879]">
              Adaptive TTS Learning Assistant
            </div>
          </button>

          <nav className="flex max-w-full flex-wrap gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`rounded-full border px-3 py-2 text-xs transition ${
                  page === item.id
                    ? 'border-[#D9BD83] bg-[#D9BD83] text-[#111111]'
                    : 'border-[#514633] text-[#C8BFAF] hover:border-[#D9BD83] hover:text-[#D9BD83]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        {(error || notice) && (
          <div className="mb-6 space-y-2">
            {error && (
              <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
                <button onClick={() => setError(null)} className="ml-3 underline">
                  Dismiss
                </button>
              </div>
            )}
            {!error && notice && (
              <div role="status" className="rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-4 py-3 text-sm text-[#E8D4A8]">
                {notice}
              </div>
            )}
          </div>
        )}

        {page === 'home' && (
          <section>
            <div className="mb-16 max-w-3xl">
              <p className="mb-5 text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                The Art of Intelligent Listening
              </p>
              <h1 className="font-serif text-5xl leading-tight text-[#F4EFE5] md:text-7xl">
                Transform words
                <span className="block italic text-[#D9BD83]">
                  into experience.
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#A69D8F]">
                An adaptive learning studio that turns your study material
                into intelligent speech, personalized pacing and a better
                listening experience.
              </p>
              <button
                onClick={() => setPage('text')}
                className="mt-9 rounded-full bg-[#D9BD83] px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition hover:bg-[#F0DDAE]"
              >
                Enter the Studio →
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  id: 'text' as Page,
                  number: '01',
                  title: 'Text Studio',
                  description: 'Turn written text into intelligent speech.'
                },
                {
                  id: 'document' as Page,
                  number: '02',
                  title: 'Document Studio',
                  description: 'Upload study documents and create segments.'
                },
                {
                  id: 'voice' as Page,
                  number: '03',
                  title: 'Voice Atelier',
                  description: 'Personalize voice and listening speed.'
                },
                {
                  id: 'insights' as Page,
                  number: '04',
                  title: 'Learning Insights',
                  description: 'Explore your learning activity and bookmarks.'
                }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className="group min-h-52 rounded-2xl border border-[#514633]/70 bg-gradient-to-br from-[#171512] to-[#0D0D0D] p-6 text-left transition hover:-translate-y-1 hover:border-[#D9BD83]/70"
                >
                  <div className="text-xs tracking-[0.25em] text-[#C8A96B]">
                    {item.number}
                  </div>
                  <h2 className="mt-9 font-serif text-2xl text-[#F4EFE5] group-hover:text-[#D9BD83]">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#A69D8F]">
                    {item.description}
                  </p>
                  <div className="mt-5 text-xs uppercase tracking-widest text-[#D9BD83]">
                    Explore →
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {(page === 'text' || page === 'document') && (
          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Studio / {page === 'text' ? '01' : '02'}
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[#F4EFE5] md:text-5xl">
              {page === 'text' ? 'Text Studio' : 'Document Studio'}
            </h1>
            <p className="mb-9 mt-3 text-sm text-[#A69D8F]">
              Prepare your learning material and listen with adaptive pacing.
            </p>

            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <div className="rounded-2xl border border-[#514633]/60 bg-[#11100E] p-4">
                <UploadPanel
                  userId={USER_ID}
                  onLoaded={handleLoaded}
                  onError={setError}
                />
              </div>

              <div className="min-w-0 rounded-2xl border border-[#514633]/60 bg-[#11100E] p-4 md:p-6">
                {doc ? (
                  <>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-serif text-2xl text-[#D9BD83]">
                        {doc.document.title}
                      </h2>
                      <label className="flex items-center gap-2 text-xs text-[#C8BFAF]">
                        <input
                          type="checkbox"
                          checked={showSsml}
                          onChange={(e) => setShowSsml(e.target.checked)}
                          className="accent-[#C8A96B]"
                        />
                        Show SSML
                      </label>
                    </div>
                    <SegmentList
                      title={doc.document.title}
                      segments={segments}
                      activeIndex={index}
                      bookmarkedIds={bookmarkedIds}
                      showSsml={showSsml}
                      onSelect={setIndex}
                    />
                  </>
                ) : (
                  <div className="flex min-h-80 items-center justify-center text-center text-sm leading-7 text-[#918879]">
                    Your processed learning material and segments will appear here.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {page === 'voice' && (
          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Personalization / 03
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[#F4EFE5] md:text-5xl">
              Voice Atelier
            </h1>
            <p className="mb-9 mt-3 text-sm text-[#A69D8F]">
              Shape your listening experience with voice and speed preferences.
            </p>
            <div className="max-w-2xl rounded-2xl border border-[#514633]/60 bg-[#11100E] p-5">
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
            </div>
          </section>
        )}

        {page === 'insights' && (
          <section>
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              Your Progress / 04
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[#F4EFE5] md:text-5xl">
              Learning Insights
            </h1>
            <p className="mb-9 mt-3 text-sm text-[#A69D8F]">
              Review your learning activity, progress and saved segments.
            </p>
            <div className="max-w-3xl rounded-2xl border border-[#514633]/60 bg-[#11100E] p-5">
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
            </div>
          </section>
        )}
      </main>

      {doc && current && (
        <footer className="sticky bottom-0 z-20 border-t border-[#C8A96B]/30 bg-[#10100F]/95 backdrop-blur-xl">
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
                           
