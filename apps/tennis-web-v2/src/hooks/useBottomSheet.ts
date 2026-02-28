import { useState, useCallback } from "react";
import type { SheetContent } from "../types";

export function useBottomSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<SheetContent | null>(null);

  const open = useCallback((sheetContent: SheetContent) => {
    setContent(sheetContent);
    setIsOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setContent(null);
    document.body.style.overflow = "";
  }, []);

  return { isOpen, content, open, close };
}
