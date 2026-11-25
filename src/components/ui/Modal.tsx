import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 'lg' para telas com listas e tabelas. Padrão: 'md'. */
  size?: 'md' | 'lg';
}

/** Diálogo acessível baseado no <dialog> nativo (foco preso, Esc fecha). */
export function Modal({ open, title, onClose, children, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={clsx('m-auto w-[calc(100%-1.5rem)] rounded-lg border border-line2 bg-surface p-0 text-fg backdrop:bg-black/70', size === 'lg' ? 'max-w-3xl' : 'max-w-lg')}
    >
      {open && (
        <div className="max-h-[90vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-h3">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1.5 text-mute hover:bg-surface2 hover:text-fg">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
