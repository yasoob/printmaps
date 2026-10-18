import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RefObject } from "react";
import { IconTooltip } from "./IconTooltip";

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
    <IconTooltip label={label}>
      <Button
        ref={buttonRef}
        className="tool-settings-toggle"
        variant="ghost"
        aria-label={label}
        onClick={onOpen}
      >
        <Settings2 aria-hidden="true" size={16} strokeWidth={1.75} />
        <span>Settings</span>
      </Button>
    </IconTooltip>
  );
}
