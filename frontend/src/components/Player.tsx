import { useEffect, useRef, useState } from 'react';
import { BookmarkCheck, Bookmark, Gauge, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { audioUrl } from '../services/api';
import type { FeedbackAction, Segment } from '../types';

/** Reads the pause lengths from the SSML spec (the same breaks the prosody controller generated). */
export function parseBreaks(ssml: string): { before: number; after: number } {
  const values = Array.from(ssml.matchAll(/<break time="(\d+)ms"\/>/g), (m) => Number(m[1]));
  return { before: values[0] ?? 0, after: values.length > 1 ? values[values.length - 1] : 0 };
}

interface Props {
  segment: Segment | undefined;
  nextSegment: Segment | undefined;
  hasPrevious: boolean;
  userId: string;
  playing: boolean;
  replayNonce: number;
  bookmarked: boolean;
  onPlayingChange: (playing: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onAction: (action: FeedbackAction) => void;
  onError: (message: string) => void;
}

export function Player(props: Props) {
  const { segment, nextSegment, hasPrevious, userId, playing, replayNonce, bookmarked } = props;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  // Latest props for event handlers that outlive a render.
  const latest = useRef(props);
  latest.current = props;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Load the segment's audio whenever the segment changes or replay is requested.
  useEffect(() => {
    const current = latest.current;
    if (!current.segment) return;
    const { before, after } = parseBreaks(current.segment.generated_ssml);
    const audio = new Audio(audioUrl(current.segment.segment_id, current.userId));
    audio.preload = 'auto';
    audioRef.current = audio;
    setLoading(true);
    setProgress(0);

    audio.oncanplay = () => setLoading(false);
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.onerror = () => {
      setLoading(false);
      latest.current.onPlayingChange(false);
      latest.current.onError('Audio could not be generated. Check that the backend is running.');
    };
    audio.onended = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        const now = latest.current;
        if (now.nextSegment) now.onNext();
        else now.onPlayingChange(false);
      }, after);
    };

    if (current.playing) {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        audio.play().catch(() => latest.current.onPlayingChange(false));
      }, before);
    }
    return () => {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment?.segment_id, replayNonce, userId]);

  // Play / pause toggle.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      clearTimer();
      audio.play().catch(() => latest.current.onPlayingChange(false));
    } else {
      clearTimer();
      audio.pause();
    }
  }, [playing]);

  // Prefetch the next segment so the adaptive pause/transition stays smooth (TC-05).
  useEffect(() => {
    if (!nextSegment) return;
    fetch(audioUrl(nextSegment.segment_id, userId)).catch(() => undefined);
  }, [nextSegment?.segment_id, userId]);

  if (!segment) return null;
  const percent = Math.round(segment.complexity_score * 100);

  const controlClass =
    'flex h-10 w-10 items-center justify-center rounded-full border border-lux-border text-lux-text transition hover:border-lux-gold hover:text-lux-gold disabled:opacity-30';
  const feedbackClass =
    'flex items-center gap-1.5 rounded-full border border-lux-border px-3 py-1.5 text-xs text-lux-textMuted transition hover:border-lux-gold hover:text-lux-gold';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
      <div className="h-1 w-full overflow-hidden rounded-full bg-lux-border" aria-hidden>
        <div className="h-full bg-lux-gold transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-lux-text">
            Segment {segment.sequence_order} · <span className="capitalize text-lux-gold">{segment.content_type}</span>
            {loading && <span className="ml-2 text-lux-textDim">synthesizing…</span>}
          </p>
          <p className="text-xs text-lux-textDim">Complexity {percent}%</p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={controlClass} onClick={props.onPrevious} disabled={!hasPrevious} aria-label="Previous segment">
            <SkipBack className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-lux-gold text-lux-bg transition hover:bg-lux-champagne"
            onClick={() => props.onPlayingChange(!playing)}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
          </button>
          <button type="button" className={controlClass} onClick={props.onNext} disabled={!nextSegment} aria-label="Next segment">
            <SkipForward className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={controlClass} onClick={() => props.onAction('replay')} aria-label="Replay segment">
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={feedbackClass} onClick={() => props.onAction('too_complex')}>
            <Gauge className="h-3.5 w-3.5" aria-hidden /> Too complex — slow down
          </button>
          <button type="button" className={feedbackClass} onClick={() => props.onAction('speed_up')}>
            <Gauge className="h-3.5 w-3.5" aria-hidden /> Too slow — speed up
          </button>
          <button
            type="button"
            className={feedbackClass}
            onClick={() => props.onAction('bookmark')}
            disabled={bookmarked}
          >
            {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" aria-hidden /> : <Bookmark className="h-3.5 w-3.5" aria-hidden />}
            {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
      </div>
    </div>
  );
}
