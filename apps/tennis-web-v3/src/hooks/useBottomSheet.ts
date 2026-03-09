import { useState, useCallback, useEffect } from "react";
import type { SheetContent } from "../types";

export function useBottomSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<SheetContent | null>(null);

  // Manage body overflow via useEffect so it cleans up on unmount
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const open = useCallback((sheetContent: SheetContent) => {
    setContent(sheetContent);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setContent(null);
  }, []);

  return { isOpen, content, open, close };
}
