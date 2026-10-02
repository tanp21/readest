import { useEffect, useState } from 'react';
import Popup from '@/components/Popup';
import type { Position } from '@/utils/sel';
import {
  learnWordHarvest,
  lookupWordHarvest,
  type WordHarvestLookupRequest,
  type WordHarvestLookupResult,
} from '@/services/wordharvest';

interface Props {
  request: WordHarvestLookupRequest;
  position: Position;
  trianglePosition: Position;
  width: number;
  height: number;
  onDismiss: () => void;
  onAddNote: (note: string) => void;
}

export default function WordHarvestPopup({
  request,
  position,
  trianglePosition,
  width,
  height,
  onDismiss,
  onAddNote,
}: Props) {
  const [result, setResult] = useState<WordHarvestLookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setResult(null);
    setLoading(true);
    setError('');
    void lookupWordHarvest(request)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, retry]);

  const addCard = async (): Promise<boolean> => {
    if (!result || saving) return false;
    if (saveStatus) return true;
    setSaving(true);
    setError('');
    try {
      const saved = await learnWordHarvest(result.lookupId);
      setSaveStatus(
        saved.ankiState === 'synced'
          ? 'Added to Anki.'
          : saved.ankiState === 'error'
            ? 'Saved in WordHarvest. Anki needs a retry there.'
            : 'Saved in WordHarvest. Waiting for Anki.',
      );
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!result || saving || !(await addCard())) return;
    const examples = result.examples.map((example) => `• ${example}`).join('  \n');
    const note = [
      `**${result.canonicalTerm}**${result.partOfSpeech ? ` · *${result.partOfSpeech}*` : ''}`,
      result.surfaceForm !== result.canonicalTerm ? `Selected form: **${result.surfaceForm}**` : '',
      `**Definition:** ${result.definitionEn}`,
      `**Nghĩa tiếng Việt:** ${result.meaningVi}`,
      examples ? `**Examples:**  \n${examples}` : '',
      `**Context:** “${request.sentence}”`,
    ]
      .filter(Boolean)
      .join('  \n');
    onAddNote(note);
  };

  return (
    <Popup
      trianglePosition={trianglePosition}
      position={position}
      width={width}
      minHeight={height}
      maxHeight={720}
      className='max-h-full overflow-y-auto p-4 font-sans select-text eink-bordered'
      onDismiss={onDismiss}
    >
      <h2 className='mb-2 text-base font-semibold'>WordHarvest</h2>
      {loading && <p role='status'>Looking up the selected expression…</p>}
      {error && (
        <div role='alert'>
          <p className='text-red-600'>{error}</p>
          {!result && (
            <button
              className='btn btn-ghost eink-bordered mt-2'
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {result && (
        <>
          <p>
            <strong>{result.canonicalTerm}</strong>
            {result.partOfSpeech && ` · ${result.partOfSpeech}`}
          </p>
          {result.surfaceForm !== result.canonicalTerm && (
            <p className='text-sm opacity-70'>Selected: {result.surfaceForm}</p>
          )}
          <p className='mt-3'>{result.definitionEn}</p>
          <p className='mt-2'>{result.meaningVi}</p>
          <ul className='mt-3 list-disc ps-5'>
            {result.examples.map((example, index) => (
              <li key={`${index}-${example}`}>{example}</li>
            ))}
          </ul>
          <p className='mt-3 text-xs opacity-70'>Context: {request.sentence}</p>
          <div className='mt-3 flex flex-wrap gap-2'>
            <button className='btn btn-contrast' disabled={saving} onClick={() => void addNote()}>
              {saving ? 'Saving…' : 'Learn'}
            </button>
            {saveStatus ? (
              <p role='status' className='self-center'>
                {saveStatus}
              </p>
            ) : (
              <button
                className='btn btn-ghost eink-bordered'
                disabled={saving}
                onClick={() => void addCard()}
              >
                {saving ? 'Adding…' : 'Add Anki card'}
              </button>
            )}
          </div>
        </>
      )}
    </Popup>
  );
}
