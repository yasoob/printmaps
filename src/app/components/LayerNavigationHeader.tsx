import { Tooltip } from '@base-ui/react/tooltip';
import { CircleHelp, Search } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

function LayerNavigationHelp() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const portalRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const open = previewOpen || pinned;

  return (
    <div ref={portalRef} className="layer-help">
      <Tooltip.Root
        open={open}
        onOpenChange={(nextOpen, details) => {
          setPreviewOpen(nextOpen);
          if (details.reason === 'escape-key' || details.reason === 'outside-press') setPinned(false);
        }}
      >
        <Tooltip.Trigger
          className="icon-button"
          aria-label="Layer keyboard shortcuts"
          aria-expanded={open}
          aria-describedby={open ? popupId : undefined}
          delay={200}
          closeDelay={150}
          closeOnClick={false}
          onClick={() => {
            setPinned(!pinned);
            setPreviewOpen(false);
          }}
        >
          <CircleHelp size={15} aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Portal container={portalRef}>
          <Tooltip.Positioner className="layer-help-positioner" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
            <Tooltip.Popup id={popupId} role="tooltip" className="layer-help-popup">
              <strong>Layer shortcuts</strong>
              <dl>
                <div><dt><kbd>&darr;</kbd></dt><dd>Enter layers from search</dd></div>
                <div><dt><kbd>&uarr; / &darr;</kbd></dt><dd>Focus a layer name</dd></div>
                <div><dt><kbd>Home / End</kbd></dt><dd>Focus first / last layer</dd></div>
                <div><dt><kbd>Enter</kbd></dt><dd>Select focused layer</dd></div>
                <div><dt><kbd>Tab</kbd></dt><dd>Move between actions</dd></div>
                <div><dt><kbd>Alt + &uarr; / &darr;</kbd></dt><dd>Move layer from Reorder</dd></div>
              </dl>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  );
}

type Props = {
  collapseButton: ReactNode;
  filterId: string;
  helpKey: string;
  searchOpen: boolean;
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleSearch: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export function LayerNavigationHeader({
  collapseButton, filterId, helpKey, searchOpen, searchButtonRef, onToggleSearch, onKeyDown,
}: Props) {
  return (
    <div className="panel-header" onKeyDown={onKeyDown}>
      <span>Layers</span>
      <div className="layer-header-actions">
        <div className="layer-header-secondary">
          <LayerNavigationHelp key={helpKey} />
          <button
            ref={searchButtonRef}
            className="icon-button layer-search-toggle"
            type="button"
            aria-label="Search layers"
            aria-controls={filterId}
            aria-expanded={searchOpen}
            title={searchOpen ? 'Close layer search' : 'Search layers'}
            onClick={onToggleSearch}
          >
            <Search size={15} aria-hidden="true" />
          </button>
        </div>
        {collapseButton}
      </div>
    </div>
  );
}
