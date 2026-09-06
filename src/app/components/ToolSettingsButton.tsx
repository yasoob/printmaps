import { Settings2 } from "lucide-react";
import type { RefObject } from "react";

export function ToolSettingsButton({
  buttonRef,
  label,
  onOpen,
}: Readonly<{
  buttonRef: RefObject<HTMLButtonElement | null>;
  label: string;
  onOpen: () => void;
}>) {
  return (
    <button
      ref={buttonRef}
      className="tool-settings-toggle"
      type="button"
      aria-label={label}
      onClick={onOpen}
    >
      <Settings2 aria-hidden="true" size={16} />
      <span>Settings</span>
    </button>
  );
}
