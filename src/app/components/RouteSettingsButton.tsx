import { Settings2 } from "lucide-react";

export function RouteSettingsButton({
  onOpen,
}: Readonly<{
  onOpen: () => void;
}>) {
  return (
    <button
      className="route-settings-toggle"
      type="button"
      aria-label="Show route settings"
      onClick={onOpen}
    >
      <Settings2 aria-hidden="true" size={16} />
      <span>Settings</span>
    </button>
  );
}
