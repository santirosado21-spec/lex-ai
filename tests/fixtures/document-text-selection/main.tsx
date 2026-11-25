// Synthetic, throwaway harness for tests/document-text-selection.test.mjs.
// Mounts the REAL src/DocumentText.tsx component (unmodified import) so the
// repro exercises actual production code, not a reimplementation.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import DocumentText from '../../../src/DocumentText';

declare global {
  interface Window {
    __extracts: string[];
    __setText: (next: string) => void;
  }
}

window.__extracts = [];

function Harness() {
  const [text, setText] = useState('TEXTO SINTETICO INICIAL. Parte A del documento de prueba.');
  window.__setText = setText;
  return <DocumentText text={text} onExtract={excerpt => { window.__extracts.push(excerpt); }} />;
}

createRoot(document.getElementById('root')!).render(<Harness />);
