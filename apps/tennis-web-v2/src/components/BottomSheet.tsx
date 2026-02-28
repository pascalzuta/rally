import { useCallback, useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ isOpen, onClose, title, children }: Props) {
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSheetClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sheet-backdrop" onClick={handleBackdropClick}>
      <div
        className="sheet-container"
        onClick={handleSheetClick}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Bottom sheet"}
      >
        <div className="sheet-handle" />
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-content">{children}</div>
      </div>
    </div>
  );
}
