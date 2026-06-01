import { Scale } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LEGAL_DOCS, LEGAL_DOC_ORDER, type LegalDocId } from '../lib/legalConfig';

type LegalModalProps = {
  open: boolean;
  initialDoc?: LegalDocId;
  onClose: () => void;
};

export function LegalModal({ open, initialDoc = 'disclaimer', onClose }: LegalModalProps) {
  const [activeDoc, setActiveDoc] = useState<LegalDocId>(initialDoc);

  useEffect(() => {
    if (open) setActiveDoc(initialDoc);
  }, [open, initialDoc]);

  if (!open) return null;

  const doc = LEGAL_DOCS[activeDoc];

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 px-4 backdrop-blur">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-cyan-300/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <Scale className="text-cyan-200" size={22} />
            <div>
              <h2 className="text-lg font-bold text-white">Legal &amp; disclaimers</h2>
              <p className="text-xs text-slate-400">Please read these terms. Your use of the app is subject to them.</p>
            </div>
          </div>
          <button className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/10 px-6 py-3">
          {LEGAL_DOC_ORDER.map((id) => (
            <button
              key={id}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${activeDoc === id ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
              type="button"
              onClick={() => setActiveDoc(id)}
            >
              {LEGAL_DOCS[id].title}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-200">{doc.body}</pre>
        </div>
      </div>
    </div>,
    document.body,
  );
}
