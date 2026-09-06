import { useLayoutEffect, useState } from 'react';

function hasFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

type MapDataDropOptions = {
  isDisabled: boolean;
  isOpen: boolean;
  onFiles: (files: readonly File[]) => void;
  onBlockedDrop: () => void;
};

export function useMapDataDrop({ isDisabled, isOpen, onFiles, onBlockedDrop }: MapDataDropOptions) {
  const [isDragActive, setIsDragActive] = useState(false);

  useLayoutEffect(() => {
    const isBlocked = isDisabled || isOpen;
    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (!isBlocked) setIsDragActive(true);
    };
    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = isBlocked ? 'none' : 'copy';
    };
    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setIsDragActive(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setIsDragActive(false);
      const files = [...(event.dataTransfer?.files ?? [])];
      if (files.length > 0) {
        if (isBlocked) onBlockedDrop();
        else onFiles(files);
      }
    };
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [isDisabled, isOpen, onBlockedDrop, onFiles]);

  return isDisabled || isOpen ? false : isDragActive;
}
