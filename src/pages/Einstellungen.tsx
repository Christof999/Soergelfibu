import { useForm } from 'react-hook-form';
import { Save, Download, Upload } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useApp } from '../context/AppContext';
import { Firma, AppData } from '../types';

export default function Einstellungen() {
  const { data, updateFirma, exportData, importData } = useApp();

  const { register, handleSubmit } = useForm<Firma>({
    defaultValues: data.firma,
  });

  const onSubmit = async (formData: Firma) => {
    await updateFirma({ ...data.firma, ...formData });
    alert('Einstellungen gespeichert.');
  };

  const handleExport = () => {
    const json = JSON.stringify(exportData(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soergelfibu_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as AppData;
        await importData(parsed);
        alert('Daten erfolgreich importiert.');
      } catch {
        alert('Fehler beim Importieren der Datei.');
      }
    };
    input.click();
  };

  const section = (title: string) => (
    <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-3 pb-1 border-b border-gray-100">{title}</h3>
  );

  const field = (label: string, name: keyof Firma, type: string = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        {...register(name)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Einstellungen"
        subtitle="Firmendaten und App-Konfiguration"
        actions={
          <div className="flex gap-2">
            <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              <Upload size={15} /> Importieren
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={15} /> Exportieren
            </button>
          </div>
        }
      />

      <div className="p-8">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            {section('Firmeninformationen')}
            <div className="grid grid-cols-2 gap-4">
              {field('Firmenname', 'name')}
              {field('Inhaber', 'inhaber')}
              {field('E-Mail', 'email', 'email')}
              {field('Telefon', 'telefon', 'tel')}
              {field('Website', 'website')}
              {field('USt-IdNr.', 'ustId')}
              {field('Steuernummer', 'steuernummer')}
            </div>

            {section('Adresse')}
            <div className="grid grid-cols-3 gap-4">
              {field('Straße', 'strasse')}
              {field('PLZ', 'plz')}
              {field('Ort', 'ort')}
            </div>
            <div className="mt-4">{field('Land', 'land')}</div>

            {section('Bankverbindung')}
            <div className="grid grid-cols-2 gap-4">
              {field('IBAN', 'iban')}
              {field('BIC', 'bic')}
              {field('Bank', 'bank')}
            </div>

            {section('Nummerierung')}
            <div className="grid grid-cols-2 gap-4">
              {field('Angebots-Präfix (z.B. ANG)', 'angebotPrefix')}
              {field('Rechnungs-Präfix (z.B. RE)', 'rechnungPrefix')}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nächste Angebotsnummer</label>
                <input type="number" min="1" {...register('nextAngebotNr', { valueAsNumber: true })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nächste Rechnungsnummer</label>
                <input type="number" min="1" {...register('nextRechnungNr', { valueAsNumber: true })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                <Save size={15} /> Speichern
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-800 mb-1">Cloud-Synchronisation aktiv</h3>
          <p className="text-xs text-emerald-700">
            Deine Daten werden in Echtzeit in Firebase gespeichert und sind auf allen deinen Geräten verfügbar. Der JSON-Export dient als zusätzliche Sicherung.
          </p>
        </div>
      </div>
    </div>
  );
}
