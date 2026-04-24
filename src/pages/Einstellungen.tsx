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

  const inputCls = "w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  const section = (title: string) => (
    <h3 className="text-sm font-semibold text-gray-400 mt-6 mb-3 pb-1 border-b border-dark-700">{title}</h3>
  );

  const field = (label: string, name: keyof Firma, type: string = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        {...register(name)}
        className={inputCls}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Einstellungen"
        subtitle="Firmendaten und App-Konfiguration"
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 text-sm border border-dark-700 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
              <Upload size={15} /> Importieren
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm border border-dark-700 rounded-lg text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
              <Download size={15} /> Exportieren
            </button>
          </div>
        }
      />

      <div className="page-padding">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-dark-800 rounded-2xl border border-dark-700 p-4 sm:p-6">
            {section('Firmeninformationen')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Firmenname', 'name')}
              {field('Inhaber', 'inhaber')}
              {field('E-Mail', 'email', 'email')}
              {field('Telefon', 'telefon', 'tel')}
              {field('Website', 'website')}
              {field('USt-IdNr.', 'ustId')}
              {field('Steuernummer', 'steuernummer')}
            </div>

            {section('Adresse')}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {field('Straße', 'strasse')}
              {field('PLZ', 'plz')}
              {field('Ort', 'ort')}
            </div>
            <div className="mt-4">{field('Land', 'land')}</div>

            {section('Bankverbindung')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('IBAN', 'iban')}
              {field('BIC', 'bic')}
              {field('Bank', 'bank')}
            </div>

            {section('Akquise')}
            <div>{field('Termin-Link (Cal.com, Calendly…)', 'terminUrl')}</div>

            {section('Dashboard')}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Geschätzte Steuerlast auf Gewinn (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                {...register('dashboardSteuerSchaetzungProzent', { valueAsNumber: true })}
                className={inputCls}
              />
              <p className="text-xs text-gray-600 mt-1.5">
                Für die Kachel „Gewinn nach Steuer“ (vereinfacht, keine Steuerberatung).
              </p>
            </div>

            {section('Nummerierung')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Angebots-Präfix (z.B. ANG)', 'angebotPrefix')}
              {field('Rechnungs-Präfix (z.B. RE)', 'rechnungPrefix')}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nächste Angebotsnummer</label>
                <input type="number" min="1" {...register('nextAngebotNr', { valueAsNumber: true })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nächste Rechnungsnummer</label>
                <input type="number" min="1" {...register('nextRechnungNr', { valueAsNumber: true })}
                  className={inputCls} />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                <Save size={15} /> Speichern
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 bg-emerald-900/30 border border-emerald-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-1">Cloud-Synchronisation aktiv</h3>
          <p className="text-xs text-emerald-500">
            Deine Daten werden in Echtzeit in Firebase gespeichert und sind auf allen deinen Geräten verfügbar. Der JSON-Export dient als zusätzliche Sicherung.
          </p>
        </div>
      </div>
    </div>
  );
}
