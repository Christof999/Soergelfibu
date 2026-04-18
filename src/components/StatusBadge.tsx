import { DokumentStatus } from '../types';

const config: Record<DokumentStatus, { label: string; cls: string }> = {
  entwurf:      { label: 'Entwurf',     cls: 'bg-gray-700/60 text-gray-300' },
  gesendet:     { label: 'Gesendet',    cls: 'bg-blue-900/60 text-blue-300' },
  akzeptiert:   { label: 'Akzeptiert',  cls: 'bg-green-900/60 text-green-300' },
  abgelehnt:    { label: 'Abgelehnt',   cls: 'bg-red-900/60 text-red-300' },
  bezahlt:      { label: 'Bezahlt',     cls: 'bg-emerald-900/60 text-emerald-300' },
  storniert:    { label: 'Storniert',   cls: 'bg-orange-900/60 text-orange-300' },
  ueberfaellig: { label: 'Überfällig',  cls: 'bg-red-800/70 text-red-200' },
};

export default function StatusBadge({ status }: { status: DokumentStatus }) {
  const { label, cls } = config[status] ?? config.entwurf;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
