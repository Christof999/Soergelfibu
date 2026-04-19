import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-400 text-sm">{message}</p>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
        <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg border border-dark-700 text-gray-400 hover:bg-dark-700 hover:text-gray-200 transition-colors">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => { onConfirm(); onClose(); }}
          className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg bg-red-700 text-white hover:bg-red-600 transition-colors"
        >
          Löschen
        </button>
      </div>
    </Modal>
  );
}
