# Print Map Studio UI brief

## Product layout

- Dense Figma-like editor, not a marketing page.
- 44px flat top bar with product title, project title, save/share/export actions.
- 240px left sidebar: search/filter, flat Layers list, visibility/lock controls and direct drag handles. The current document has one print frame, so do not show a `Page 1` collection hierarchy.
- Full-bleed map canvas in the center with a subtle neutral pasteboard and white print-frame overlay.
- 304–320px right sidebar: when selection is empty, show Project properties; when a layer is selected, show Layer properties.
- Compact floating toolbar centered near the bottom, inspired by Atlas.co: selection, pan, route, pin, shape, text, fit. It may use a 1px border and solid surface but no decorative shadow.
- Status/zoom controls stay quiet and secondary.

## Felt-inspired sidebar reference

Use the supplied Felt sidebar as a quality reference for calm density, not as branding to copy.

- Prefer a 304–320px desktop inspector so labels and values breathe. Rows follow a stable two-column rhythm: quiet left label, stronger right value/control, 40–44px vertical rhythm where practical.
- Use near-white/warm-neutral surfaces, low-contrast dividers, and borderless field fills by default. Borders strengthen only on hover, focus, validation, or selection. Avoid stacking hard full-width rules around every control.
- Apply a strict divider budget. Keep only structural shell boundaries (top bar to workspace and sidebar to canvas), the dialog perimeter, and separators whose absence would genuinely confuse unrelated regions. Inside inspectors and dialogs, spacing, typography, alignment, and a subtle surface change must do the grouping first.
- Export specifically must not look like nested bordered boxes: use a quiet shared format tray or tab treatment instead of three individually outlined cards; show Output on plain or softly tinted borderless surface; remove header/body/footer and Technical-details rules; hide idle `Ready` status when it adds no information; use a borderless ghost Cancel action and one dark primary action. Retain only the muted dialog perimeter and focus/selected/error boundaries.
- Section titles are dark and semibold; field labels are muted; values are near-black. Color belongs to map swatches and semantic states, not generic chrome.
- Keep section spacing and separators consistent. Accordions remain useful for major groups, but their headers should feel like Felt section headers rather than large boxed rows.
- Use Lucide exclusively at a consistent 16px size and approximately 1.75px stroke. Replace Unicode/text symbols such as `•••`, arrows, and handcrafted chevrons with the corresponding Lucide icon. Native select indicators may remain only if they visually match across supported browsers.
- Add one shared native-semantic Checkbox primitive with a 16px square, 4px radius, muted border, near-black checked fill, and a clearly visible white Lucide check. Preserve keyboard input, visible focus, disabled state, forced-colors behavior, and a 44px mobile hit area. Do not rely on browser `accent-color`.
- Add one shared Switch primitive for true on/off settings: near-black active track, white thumb, muted inactive track. Do not mix blue native checkboxes, custom blue toggles, and black switches.
- Use checkboxes for independent multi-select lists such as visible map categories; use switches for a standalone behavior such as `Show legend` or `Lock map area`. Both must share the same active/inactive color logic.
- Dropdown values and chevrons align consistently; color swatches use the same square size, radius, border, and spacing.

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
