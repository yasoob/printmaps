import { useEffect, useState } from 'react';

function hasFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

type MapDataDropOptions = {
  isDisabled: boolean;
  isOpen: boolean;
  onFiles: (files: readonly File[]) => void;
};

export function useMapDataDrop({ isDisabled, isOpen, onFiles }: MapDataDropOptions) {
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (isDisabled || isOpen) return;
    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setIsDragActive(true);
    };
    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setIsDragActive(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setIsDragActive(false);
      const files = [...(event.dataTransfer?.files ?? [])];
      if (files.length > 0) onFiles(files);
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
  }, [isDisabled, isOpen, onFiles]);

  return isDisabled || isOpen ? false : isDragActive;
}
