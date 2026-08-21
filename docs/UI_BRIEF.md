# Print Map Studio UI brief

## Product layout

- Dense Figma-like editor, not a marketing page.
- 44px flat top bar with product title, project title, save/share/export actions.
- 240px left sidebar: search/filter, flat Layers list, visibility/lock controls and direct drag handles. The current document has one print frame, so do not show a `Page 1` collection hierarchy.
- Full-bleed map canvas in the center with a subtle neutral pasteboard and white print-frame overlay.
- 272px right sidebar: when selection is empty, show Project properties; when a layer is selected, show Layer properties.
- Compact floating toolbar centered near the bottom, inspired by Atlas.co: selection, pan, route, pin, shape, text, fit. It may use a 1px border and solid surface but no decorative shadow.
- Status/zoom controls stay quiet and secondary.

## Visual language

- Inter/system UI, 11–13px control typography, tight but readable spacing.
- White/near-white panels, #1e1e1e text, #e5e5e5 dividers, #0d99ff selection accent.
- No gradients.
- No decorative drop shadows. Use borders, surface changes and selection outlines for hierarchy.
- Corners 4–6px; avoid oversized pills.
- Icons are one restrained 16px SVG stroke family (Lucide is acceptable).
- 28–32px compact controls with accessible labels and keyboard focus.
- Property rows align labels and controls consistently; numeric fields use tabular numerals.

## Interaction rules

- Clicking the map/background clears selection and switches the right panel to Project properties.
- Clicking a layer in the list or canvas selects it and switches the right panel to Layer properties.
- Hovering a layer list row only highlights/previews its map content; hover must not change selection.
- Dragging a layer handle reorders layers. Duplicate/Delete live in the compact layer overflow menu instead of persistent inspector action buttons.
- Layer visibility, lock, rename, delete and reorder update the canvas immediately.
- Bottom toolbar tools have clear active state and keyboard shortcuts.
- Avoid modal dialogs for routine edits; use sidebars/popovers.
- Responsive behavior may collapse sidebars into drawers below 900px, but desktop editor quality is the primary target.
