import { Search } from 'lucide-react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { FeatureHelp } from './FeatureHelp';

function LayerNavigationHelp() {
  return (
    <FeatureHelp label="Layer keyboard shortcuts" className="layer-help">
      <strong>Layer shortcuts</strong>
      <dl>
        <div><dt><kbd>&darr;</kbd></dt><dd>Enter layers from search</dd></div>
        <div><dt><kbd>&uarr; / &darr;</kbd></dt><dd>Focus a layer name</dd></div>
        <div><dt><kbd>Home / End</kbd></dt><dd>Focus first / last layer</dd></div>
        <div><dt><kbd>Enter</kbd></dt><dd>Select focused layer</dd></div>
        <div><dt><kbd>Tab</kbd></dt><dd>Move between actions</dd></div>
        <div><dt><kbd>Alt + &uarr; / &darr;</kbd></dt><dd>Move layer from Reorder</dd></div>
      </dl>
    </FeatureHelp>
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
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {collapseButton}
      </div>
    </div>
  );
}
