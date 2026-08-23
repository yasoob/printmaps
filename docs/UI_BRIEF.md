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

## Progressive disclosure and product coherence

- The editor must remain approachable as capability grows. The right inspector uses accessible accordion sections with one chevron language, keyboard support, `aria-expanded`, and useful collapsed summaries.
- Show the primary workflow first. Project defaults: Page and Map style open; Camera/location, feature visibility, provider services, and technical export settings collapsed. Layer defaults: Layer and Appearance open; Geometry/vertices, elevation, custom assets, and other specialist controls collapsed unless the active tool requires them.
- Do not nest disclosure more than one level. Persist disclosure state as local UI preference, never as project content. Changing selection opens only the contextually relevant section.
- Collapsed summaries should answer what matters without reopening: e.g. `A4 landscape · 297 × 210 mm`, `Liberty · Local names · 100%`, `7 map details visible`, `Red · 4 px · Walking`.
- Use one clear inspector title rather than stacking a tiny uppercase eyebrow above a near-duplicate heading. Avoid tiny uppercase labels as visual decoration.
- Minimum desktop typography: 13px controls/body, 12px labels/supporting text, 14px panel titles. Do not use 8–10px interface text for actionable or explanatory content. Keep 32–36px desktop controls and at least 44px touch targets on mobile.
- Use one component language for Button (primary/secondary/ghost/destructive), IconButton, Field, Select, Checkbox/Switch, Accordion, Dialog, Menu, and Status. All variants share the same height, radius, typography, border, hover, focus, disabled, and busy behavior.
- Keep chrome neutral with one blue interaction accent. Reserve red/green for error/success and content colors for map data. Borders and surface shifts establish hierarchy; avoid decorative color blocks, gradients, and shadows.
- Export is a choice flow, not four competing footer actions: choose PNG/SVG/PDF from equal format options, show a concise page/output summary, hide memory/metadata caveats under `Technical details`, and provide `Cancel` plus one format-specific primary action in a consistent footer. Busy state becomes focused progress with cancellation.
- Consolidate secondary document commands when the top bar becomes crowded; preserve one obvious primary Export action.

## Component-library decision

- Do not perform a wholesale shadcn/ui migration. The application already has tested native controls, Tailwind tokens, and domain-specific behavior; replacing them would add churn without solving information architecture.
- Use shadcn/Radix interaction patterns as reference. Add a Radix primitive selectively only when it materially improves a difficult accessibility behavior; otherwise build the small shared primitives above on the existing stack.
- Cohesion is verified through shared tokens, reusable primitives, progressive disclosure, and screenshot-driven review—not by the presence of a component-library dependency.

## Interaction rules

- Clicking the map/background clears selection and switches the right panel to Project properties.
- Clicking a layer in the list or canvas selects it and switches the right panel to Layer properties.
- Hovering a layer list row only highlights/previews its map content; hover must not change selection.
- Dragging a layer handle reorders layers. Duplicate/Delete live in the compact layer overflow menu instead of persistent inspector action buttons.
- Layer visibility, lock, rename, delete and reorder update the canvas immediately.
- Bottom toolbar tools have clear active state and keyboard shortcuts.
- Avoid modal dialogs for routine edits; use sidebars/popovers.
- Responsive behavior may collapse sidebars into drawers below 900px, but desktop editor quality is the primary target.
