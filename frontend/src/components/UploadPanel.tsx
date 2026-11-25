import { useRef, useState } from 'react';
import { FileText, Sparkles, Upload } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import type { DocumentResponse } from '../types';

const SAMPLE = `Entropy is a measure of the uncertainty in a random variable. For example, a fair coin has higher entropy than a biased coin.

The formula is H(X) = -sum p(x) log p(x), where p(x) is the probability of outcome x.

def entropy(probs): return -sum(p * math.log(p) for p in probs if p > 0)

In summary, entropy quantifies how unpredictable a source is, and it sets the limit for lossless compression.`;

interface Props {
  userId: string;
  onLoaded: (doc: DocumentResponse) => void;
  onError: (message: string) => void;
}

export function UploadPanel({ userId, onLoaded, onError }: Props) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const doc = file
        ? await api.uploadDocument(userId, file)
        : await api.createDocument(userId, 'Pasted text', text);
      onLoaded(doc);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !busy && (file !== null || text.trim().length > 0);

  return (
    <div className="space-y-5 rounded-2xl border border-lux-border bg-lux-card p-5">
      <div>
        <h2 className="font-serif text-xl text-lux-text">Study material</h2>
        <p className="mt-1 text-sm text-lux-textMuted">Upload a PDF, DOCX or TXT file, or paste your notes.</p>
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-lux-borderLight p-5 text-center hover:border-lux-gold/60">
        <Upload className="h-5 w-5 text-lux-gold" aria-hidden />
        <span className="text-sm text-lux-text">{file ? file.name : 'Choose a file'}</span>
        <span className="text-xs text-lux-textDim">PDF, DOCX or TXT, up to 10 MB</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="space-y-2">
        <label htmlFor="paste-text" className="text-xs uppercase tracking-wider text-lux-textDim">
          Or paste text
        </label>
        <textarea
          id="paste-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={file !== null}
          rows={8}
          placeholder="Paste lecture notes, definitions, formulas or code…"
          className="w-full resize-y rounded-xl border border-lux-border bg-lux-bg p-3 text-sm text-lux-text placeholder:text-lux-textDim focus:border-lux-gold focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="inline-flex items-center gap-1.5 text-xs text-lux-gold hover:underline"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden /> Load sample notes
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lux-gold px-4 py-2.5 text-sm font-semibold text-lux-bg transition hover:bg-lux-champagne disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {busy ? 'Analyzing…' : 'Analyze & segment'}
      </button>
    </div>
  );
}
