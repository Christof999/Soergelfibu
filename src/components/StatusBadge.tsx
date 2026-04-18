import { DokumentStatus } from '../types';

const config: Record<DokumentStatus, { label: string; cls: string }> = {
  entwurf:    { label: 'Entwurf',     cls: 'bg-gray-100 text-gray-600' },
  gesendet:   { label: 'Gesendet',    cls: 'bg-blue-100 text-blue-700' },
  akzeptiert: { label: 'Akzeptiert',  cls: 'bg-green-100 text-green-700' },
  abgelehnt:  { label: 'Abgelehnt',   cls: 'bg-red-100 text-red-700' },
  bezahlt:    { label: 'Bezahlt',     cls: 'bg-emerald-100 text-emerald-700' },
  storniert:  { label: 'Storniert',   cls: 'bg-orange-100 text-orange-700' },
  ueberfaellig: { label: 'Überfällig', cls: 'bg-red-200 text-red-800' },
};

export default function StatusBadge({ status }: { status: DokumentStatus }) {
  const { label, cls } = config[status] ?? config.entwurf;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
