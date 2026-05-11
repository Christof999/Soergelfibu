import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-400 text-sm">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await Promise.resolve(onConfirm());
              onClose();
            } catch (e) {
              console.error(e);
              alert(e instanceof Error ? e.message : 'Die Aktion ist fehlgeschlagen.');
            }
          }}
          className="px-4 py-2 text-sm rounded-lg bg-red-700 text-white hover:bg-red-600 transition-colors"
        >
          Löschen
        </button>
      </div>
    </Modal>
  );
}
