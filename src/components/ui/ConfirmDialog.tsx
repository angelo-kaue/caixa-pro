import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Retorna uma mensagem de erro, ou null em caso de sucesso (o diálogo fecha). */
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, children, confirmLabel = 'Excluir', danger = true, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function run() {
    setBusy(true);
    setError(null);
    const err = await onConfirm();
    setBusy(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="text-sm text-mute">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={() => void run()}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
