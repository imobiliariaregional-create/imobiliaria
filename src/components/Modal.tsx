import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-labelledby="quick-create-title">
      <button type="button" className="fixed inset-0 cursor-default" aria-label="Fechar janela" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-slate-50 p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4 px-1">
          <h2 id="quick-create-title" className="text-xl font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
