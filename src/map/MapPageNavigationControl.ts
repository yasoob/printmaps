import { NavigationControl, type Map as MapLibreMap } from 'maplibre-gl';
import { adoptControlTooltips } from './mapControlTooltips';

class PageNavigationControl {
  private readonly navigation = new NavigationControl({ showCompass: false });
  private fitButton: HTMLButtonElement | null = null;

  constructor(private readonly fitPage: () => void) {}

  onAdd(map: MapLibreMap) {
    const container = this.navigation.onAdd(map);
    container.classList.add('canvas-navigation-control');
    const fitButton = document.createElement('button');
    fitButton.type = 'button';
    fitButton.className = 'maplibregl-ctrl-icon map-fit-control';
    fitButton.setAttribute('aria-label', 'Fit page');
    fitButton.dataset.tooltip = 'Fit page';
    fitButton.dataset.tooltipShortcut = '⇧1';
    fitButton.addEventListener('click', this.fitPage);
    container.prepend(fitButton);
    adoptControlTooltips(container);
    this.fitButton = fitButton;
    return container;
  }

  onRemove() {
    this.fitButton?.removeEventListener('click', this.fitPage);
    this.fitButton = null;
    this.navigation.onRemove();
  }
}

export function createPageNavigationControl(fitPage: () => void) {
  return new PageNavigationControl(fitPage);
}
