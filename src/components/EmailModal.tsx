import { useState, useEffect, useRef } from 'react';
import { X, Copy, Download, Send, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Lead } from '../types';
import {
  buildEmailHtml,
  buildPlainText,
  EmailVars,
  buildInitialEmailVars,
  DEFAULT_STANDARD_AKQUISE_LEISTUNGSTEXT,
  type AkquiseEmailTemplateKind,
} from '../utils/emailTemplate';
import { useApp } from '../context/AppContext';

interface Props {
  lead: Lead;
  /** „analyse“ = drei KI-Punkte; „standard“ = Leistungs-Ansprache ohne KI */
  emailMode: AkquiseEmailTemplateKind;
  onClose: () => void;
  /** Nach erfolgreichem Resend-Versand: Lead in Firebase aktualisieren (nur ★-Leads) */
  onEmailSent?: (leadId: string, versendetAmIso: string) => void | Promise<void>;
}

function toast(msg: string) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#e2e8f0;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:500;z-index:99999;pointer-events:none;transition:opacity .3s';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 2000);
}

export default function EmailModal({ lead, emailMode, onClose, onEmailSent }: Props) {
  const { data } = useApp();
  const firma = data.firma;
  const analyse = lead.analyse;

  const [recipientEmail, setRecipientEmail] = useState(() => (lead.email || '').trim());

  const [vars, setVars] = useState<EmailVars>(() =>
    buildInitialEmailVars(lead, firma.terminUrl || '', emailMode)
  );

  const [tab, setTab] = useState<'vorschau' | 'felder'>('felder');
  const [sending, setSending] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildEmailHtml(vars);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = html;
    const resize = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) iframe.style.height = doc.documentElement.scrollHeight + 'px';
      } catch { /* cross-origin */ }
    };
    iframe.onload = resize;
  }, [html]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (k: keyof EmailVars, v: string) => setVars(p => ({ ...p, [k]: v }));
  const setOpt = (idx: 0 | 1 | 2, v: string) =>
    setVars(p => {
      const o = [...p.optimierungen] as [string, string, string];
      o[idx] = v;
      return { ...p, optimierungen: o };
    });

  const copyHtml = async () => {
    await navigator.clipboard.writeText(html).catch(() => {});
    toast('HTML kopiert');
  };

  const copySubject = async () => {
    await navigator.clipboard.writeText(vars.subject).catch(() => {});
    toast('Betreff kopiert');
  };

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${lead.name.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Heruntergeladen');
  };

  const sendViaResend = async () => {
    const to = recipientEmail.trim();
    if (!to.includes('@')) {
      toast('Bitte eine gültige Empfänger-E-Mail eintragen.');
      return;
    }
    setSending(true);
    try {
      const plain = buildPlainText(vars);
      const r = await fetch('/api/send-akquise-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: vars.subject,
          html,
          text: plain,
        }),
      });
      const payload = (await r.json()) as { error?: string; hint?: string; ok?: boolean; id?: string };
      if (!r.ok) {
        const msg = payload.error ?? 'Versand fehlgeschlagen';
        const hint = payload.hint ? `\n\n${payload.hint}` : '';
        alert(`${msg}${hint}`);
        return;
      }
      const versendetAm = new Date().toISOString();
      await onEmailSent?.(lead.id, versendetAm);
      toast('E-Mail wurde versendet.');
    } catch {
      alert('Netzwerkfehler. Bitte erneut versuchen oder „In Mail-App öffnen“ nutzen.');
    } finally {
      setSending(false);
    }
  };

  const openMailto = () => {
    const to = recipientEmail.trim();
    if (!to.includes('@')) {
      toast('Bitte eine gültige Empfänger-E-Mail eintragen.');
      return;
    }
    const body = buildPlainText(vars);
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(vars.subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  const markAlsVersendetManuell = async () => {
    const versendetAm = new Date().toISOString();
    try {
      await onEmailSent?.(lead.id, versendetAm);
      toast('Als versendet gespeichert.');
    } catch {
      toast('Speichern fehlgeschlagen.');
    }
  };

  const inputCls = 'w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none';
  const isStandard = vars.templateKind === 'standard';

  return (
    <div className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="m-auto w-full max-w-6xl max-h-[95vh] bg-dark-800 border border-dark-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-dark-700 shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-100">E-Mail erstellen</h2>
            <p className="text-xs text-gray-500 mt-0.5 break-words">{lead.name} · {lead.website || '—'}</p>
            <p className="text-xs text-primary-400/90 mt-1">
              {isStandard ? 'Vorlage: Standard-Ansprache (ohne KI)' : 'Vorlage: Kurzanalyse (3 Punkte)'}
            </p>
            {lead.akquiseEmailZuletztVersendetAm && (
              <p className="text-xs text-emerald-400/90 mt-1.5 flex items-start gap-1.5">
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                <span>
                  Zuletzt per E-Mail versendet:{' '}
                  {new Date(lead.akquiseEmailZuletztVersendetAm).toLocaleString('de-DE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-dark-900 rounded-lg p-0.5 border border-dark-700">
              {(['felder', 'vorschau'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    tab === t ? 'bg-dark-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'felder' ? 'Bearbeiten' : 'Vorschau'}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-700 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">

          <div className={`w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-dark-700 flex flex-col overflow-y-auto max-h-[50vh] lg:max-h-none ${tab === 'vorschau' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-5 space-y-4 flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Empfänger</p>

              <div className="space-y-1">
                <label className="block text-xs text-gray-500">E-Mail-Adresse des Empfängers</label>
                <input
                  className={inputCls}
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="kunde@firma.de"
                  autoComplete="email"
                />
                <p className="text-[11px] text-gray-600 leading-snug">
                  Für Resend und Mail-App. Aus dem Lead vorausgefüllt, falls vorhanden.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Anrede / Name</label>
                <input className={inputCls} value={vars.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Herr Mustermann" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Firmenname</label>
                <input className={inputCls} value={vars.companyName} onChange={e => set('companyName', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Website (ohne https://)</label>
                <input className={inputCls} value={vars.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} placeholder="muster-gmbh.de" />
              </div>

              <div className="border-t border-dark-700 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">E-Mail</p>
                <div className="space-y-1">
                  <label className="block text-xs text-gray-500">Betreff</label>
                  <input className={inputCls} value={vars.subject} onChange={e => set('subject', e.target.value)} />
                </div>
                <div className="space-y-1 mt-3">
                  <label className="block text-xs text-gray-500">
                    {isStandard ? 'Link im Button (Kontakt)' : 'Termin-Link (CTA)'}
                  </label>
                  <input className={inputCls} value={vars.ctaUrl} onChange={e => set('ctaUrl', e.target.value)} placeholder="https://…" />
                </div>
              </div>

              {isStandard ? (
                <div className="border-t border-dark-700 pt-4 space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Haupttext</p>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Fließtext zu Leistungen und Zusammenarbeit — Absätze mit Leerzeile trennen. Keine KI nötig.
                  </p>
                  <textarea
                    rows={14}
                    className={inputCls}
                    value={vars.standardLeistungstext ?? ''}
                    onChange={e => set('standardLeistungstext', e.target.value)}
                    placeholder={DEFAULT_STANDARD_AKQUISE_LEISTUNGSTEXT}
                  />
                </div>
              ) : (
                <div className="border-t border-dark-700 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">3 Optimierungen</p>
                    {analyse && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <RefreshCw size={10} /> KI
                      </span>
                    )}
                  </div>
                  {([0, 1, 2] as const).map(idx => (
                    <div key={idx} className="space-y-1">
                      <label className="block text-xs text-gray-500">Punkt {idx + 1}</label>
                      <textarea
                        rows={3}
                        className={inputCls}
                        value={vars.optimierungen[idx]}
                        onChange={e => setOpt(idx, e.target.value)}
                        placeholder={`Optimierung ${idx + 1}…`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-dark-700 space-y-2 shrink-0">
              <button
                type="button"
                disabled={sending || !recipientEmail.trim().includes('@')}
                onClick={sendViaResend}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                {sending ? 'Wird gesendet…' : 'Jetzt versenden (Resend)'}
              </button>
              <p className="text-[11px] text-gray-600 leading-snug">
                Benötigt in Vercel:{' '}
                <code className="text-gray-500">RESEND_API_KEY</code> und{' '}
                <code className="text-gray-500">RESEND_FROM_EMAIL</code> (verifizierte Domain bei Resend).
                Nach erfolgreichem Versand wird das Datum bei ★-Leads in der Cloud gespeichert.
              </p>
              <button
                type="button"
                onClick={openMailto}
                disabled={!recipientEmail.trim().includes('@')}
                className="w-full flex items-center justify-between px-4 py-2.5 border border-dark-600 text-gray-300 text-sm font-medium rounded-lg hover:bg-dark-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">In Mail-App öffnen (mailto)</span>
                <ExternalLink size={12} className="opacity-60" />
              </button>
              <p className="text-[11px] text-gray-600 leading-snug">
                mailto überträgt nur Klartext. Für HTML nutze Resend oder HTML kopieren.
              </p>
              {onEmailSent && (
                <button
                  type="button"
                  onClick={markAlsVersendetManuell}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-emerald-800/60 text-emerald-300 rounded-lg hover:bg-emerald-900/25 transition-colors"
                >
                  <CheckCircle2 size={14} />
                  Als versendet markieren (z. B. nach Mail-App)
                </button>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={copyHtml} className="flex flex-col items-center gap-1 px-2 py-2 border border-dark-700 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
                  <Copy size={13} /><span className="text-xs">HTML</span>
                </button>
                <button type="button" onClick={copySubject} className="flex flex-col items-center gap-1 px-2 py-2 border border-dark-700 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
                  <Copy size={13} /><span className="text-xs">Betreff</span>
                </button>
                <button type="button" onClick={download} className="flex flex-col items-center gap-1 px-2 py-2 border border-dark-700 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
                  <Download size={13} /><span className="text-xs">.html</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`flex-1 overflow-auto bg-[#F5F3EF] min-h-[280px] ${tab === 'felder' ? 'hidden lg:block' : 'block'}`}>
            <iframe
              ref={iframeRef}
              title="E-Mail Vorschau"
              className="w-full border-0 block"
              style={{ minHeight: '600px' }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
