/*
 * MapLibre controls set native `title` hints, which render differently per OS and duplicate the
 * aria-label. Move them to `data-tooltip` so the editor's shared tooltip presents them instead.
 */
export function adoptControlTooltips(root: ParentNode, shortcuts: Readonly<Record<string, string>> = {}) {
  for (const element of root.querySelectorAll<HTMLElement>('[title]')) {
    const label = element.getAttribute('title') ?? '';
    element.removeAttribute('title');
    if (!label) continue;
    element.dataset.tooltip = label;
    if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', label);
    const shortcut = shortcuts[label];
    if (shortcut) element.dataset.tooltipShortcut = shortcut;
  }
}
