# Print Map Studio UI brief

## Product layout

- Dense Figma-like editor, not a marketing page.
- 44px flat top bar with product title, inline desktop project title, a compact Project menu, and primary Export action. Project contains New, Open, Download, and Import; do not add Share or an archive-download action.
- 240px left sidebar: search/filter, flat Layers list, visibility/lock controls and direct drag handles. The current document has one print frame, so do not show a `Page 1` collection hierarchy.
- Desktop Layers collapse to a narrow reopening rail without changing the document or selection. Mobile drawer dismissal is independent of this desktop layout state.
- Full-bleed map canvas in the center with a subtle neutral pasteboard and white print-frame overlay.
- 304–320px right sidebar: when selection is empty, show Project properties; when a layer is selected, show Layer properties.
- Compact floating toolbar centered near the bottom, inspired by Atlas.co: selection, pan, route, pin, area, and fit. It may use a 1px border and solid surface but no decorative shadow.
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
- Add one shared native-semantic Checkbox primitive with a 16px square, 4px radius, muted border, primary-blue checked fill, and a clearly visible white Lucide check. Preserve keyboard input, visible focus, disabled state, forced-colors behavior, and a 44px mobile hit area. Do not rely on browser `accent-color`.
- Add one shared Switch primitive for true on/off settings: primary-blue active track, white thumb, muted inactive track. Keep native checkboxes, custom controls, and switches on the same primary interaction color.
- Use checkboxes for independent multi-select lists such as visible map categories; use switches for a standalone behavior such as `Show legend` or `Lock map area`. Both must share the same active/inactive color logic.
- Dropdown values and chevrons align consistently; color swatches use the same square size, radius, border, and spacing.

## Visual language

- Inter/system UI, 11–13px control typography, tight but readable spacing.
- White/near-white panels, #1e1e1e text, #e5e5e5 dividers, #0d78b5 primary interaction color (at least 4.5:1 with white normal-sized labels).
- No gradients.
- No decorative drop shadows. Use borders, surface changes and selection outlines for hierarchy.
- Corners 4–6px; avoid oversized pills.
- Icons are one restrained 16px SVG stroke family (Lucide is acceptable).
- 28–32px compact controls with accessible labels and keyboard focus.
- Property rows align labels and controls consistently; numeric fields use tabular numerals.
- Project numeric fields share one draft/commit contract: show specific validation feedback, retain rejection explanations after restoring a saved value, commit on Enter/blur, and cancel on Escape. Updating a value must not remount the focused field.

## Progressive disclosure and product coherence

- The editor must remain approachable as capability grows. The right inspector uses accessible accordion sections with one chevron language, keyboard support, `aria-expanded`, and useful collapsed summaries.
- Show the primary workflow first. Project defaults: Page and Map style open; Camera/location, feature visibility, provider services, and technical export settings collapsed. Layer defaults: Layer and Appearance open; Geometry/vertices, elevation, custom assets, and other specialist controls collapsed unless the active tool requires them.
- Do not nest disclosure more than one level. Persist disclosure state as local UI preference, never as project content. Changing selection opens only the contextually relevant section.
- Collapsed summaries should answer what matters without reopening: e.g. `A4 landscape · 297 × 210 mm`, `Liberty · Local names · 100%`, `7 map details visible`, `Red · 4 px · Walking`. Render and announce the summary only while its accordion is collapsed; once expanded, the visible controls are the source of truth and the summary disappears.
- Accordion chevrons align directly with the title row/baseline, never vertically centered across the title-plus-summary block. The collapsed summary occupies a second line indented to the title column; an expanded header becomes a compact single title row.
- Use one clear inspector title rather than stacking a tiny uppercase eyebrow above a near-duplicate heading. Avoid tiny uppercase labels as visual decoration.
- Minimum desktop typography: 13px controls/body, 12px labels/supporting text, 14px panel titles. Do not use 8–10px interface text for actionable or explanatory content. Keep 32–36px desktop controls and at least 44px touch targets on mobile.
- Use one component language for Button (primary/secondary/ghost/destructive), IconButton, Field, Select, Checkbox/Switch, Accordion, Dialog, Menu, and Status. All variants share the same height, radius, typography, border, hover, focus, disabled, and busy behavior.
- Keep chrome neutral with one blue interaction accent. Reserve red/green for error/success and content colors for map data. Borders and surface shifts establish hierarchy; avoid decorative color blocks, gradients, and shadows.
- Export is a choice flow, not four competing footer actions: choose PNG/SVG/PDF from equal format options, show a concise page/output summary, hide memory/metadata caveats under `Technical details`, and provide `Cancel` plus one format-specific primary action in a consistent footer. Busy state becomes focused progress with cancellation.
- Selected-format preflight must block predictable failures before download. Explain memory limits in readable units and name practical alternatives with their quality tradeoffs. Keep export header/actions fixed while long settings or error guidance scroll by keyboard.
- Keep Project and Export as the header actions. Project holds document/history commands responsively; do not add Share or an archive-download action.
- Background autosave preserves completed project content. Project > Download project downloads that portable content; it is not an unsaved-state indicator. Open accepts supported portable project files, Import adds map data, and Export produces map output.
- Opening a project over existing work requires an explicit replacement decision. Offer Download current project, Keep editing, and Replace project; downloading must leave the current document and confirmation intact. Protect restored projects and basemap-only designs even without Undo history. Only genuinely pristine defaults may open without interruption.
- New project uses the canonical blank factory and the same outgoing-work protection, with New-specific copy. Confirmed creation is a fresh history root; ordinary startup still restores the local project. Older file reads or canceled confirmations must not replace a newer choice.
- Unfinished routes, areas, and point inputs are not autosaved or downloaded. Report them separately from actual save status and warn before leaving/replacing them. Native navigation warnings are browser-dependent, not a promise of recovery after mobile/OS termination.
- Admit canonical edits against shared project-file constraints before changing history or selection. Reject oversized batches atomically with remaining-capacity guidance; retain correctable names, pasted rows, and drawing drafts. Rejected previews restore the latest rendered geometry separately from semantic waypoint handles.
- Damaged local drafts offer recovery-data download, non-destructive continuation without autosave, and explicit discard/retry. Recovery data is not a portable project. Keep the original storage record untouched during offline editing, disclose that state below search without obscuring it, and keep recovery details keyboard-scrollable independently of the actions.
- Cross-tab conflicts stop the losing writer and preserve its in-memory version. Offer a separate completed-project backup, Keep editing, and a deliberate saved-version load; never replace automatically after downloading. Canceled or stale reads must not resume autosave, and newer saved records remain protected by identity/revision checks.
- Portable project edits must fit the shared compact UTF-8 byte limit. Use readable JSON when it fits and compact JSON when necessary, without losing content. Rejected scalar edits stay correctable with visible feedback; rejected native camera or marker changes restore the current canonical view without changing history.
- Chooser and drag imports use the same explicit review, with Fit imported content by default and a Keep current view choice. Cancellation and project replacement retire the read owner; old IO cannot alter a newer review. Import-style field state, submission, and application share one string-aware validator; blank is not zero.
- Address lists separate lookup from addition: show matched locality/coordinates, allow candidate choice, correction and exclusion, then commit the chosen batch once. Preserve independent coordinate/address buffers in memory, use mode-specific notices, and guard tool changes—including route extension—before discarding lists. Unadded lists are never included in project saves/downloads.
- File-workflow feedback shares one bounded, error-first stack rather than overlapping fixed notices. Keep error priority consistent in DOM and visual order, provide touch-sized dismissal, and restore focus without changing unrelated workflow state.
- When the narrow layout hides the history toolbar, Project exposes the same Undo/Redo commands with their current enabled states and full touch targets.
- On phones, Project shows the full current name and a Rename action. Rename uses a focused, cancellable dialog coordinated with the editor's other modal surfaces; the header does not gain an extra row or reduce canvas space.
- Prioritize the place-search field on narrow phones: panel commands may become icon-only while retaining accessible names and full touch targets. Keep the search input readable within the same toolbar row.

## Component-library decision

- Do not perform a wholesale shadcn/ui migration. The application already has tested native controls, Tailwind tokens, and domain-specific behavior; replacing them would add churn without solving information architecture.
- Use shadcn/Radix interaction patterns as reference. Add a Radix primitive selectively only when it materially improves a difficult accessibility behavior; otherwise build the small shared primitives above on the existing stack.
- Cohesion is verified through shared tokens, reusable primitives, progressive disclosure, and screenshot-driven review—not by the presence of a component-library dependency.

## Map preset gallery

Use the Mapiful editor as an interaction reference for making many visual choices approachable, without copying its names, code, thumbnails, tile endpoints, or proprietary assets.

- Keep the Map style accordion preview-first: show the complete responsive 3-column desktop / 2-column mobile thumbnail grid directly, without a wrapping textual theme-family filter row. A selected style uses one clear dark outline/check state; unselected cards remain border-light. Keep each concise preset name on one ellipsized line and retain the full accessible name/description.
- Do not repeat source attribution beneath the preset thumbnails; the live map already carries the required visible provider/data attribution. Mandatory attribution remains on the map and in exported artifacts where required.
- Generate and own every preview from our open OpenFreeMap/OpenMapTiles style pipeline at one deterministic representative location. Do not ship screenshots or requests from Mapiful.
- Build presets from named semantic tokens—canvas, land, water, parks, buildings, major/minor roads, boundaries, transit, labels, and halos—rather than ad-hoc color substitutions. Validate label contrast and visibility for each preset.
- Start with a coherent collection of at least 10–12 genuinely distinct presets spanning monochrome, paper, dark, coastal, natural, warm, cool, and expressive treatments. Preserve language, text scale, feature visibility, camera, overlays, persistence, and native/SVG/PDF export when switching.
- Preview selection immediately but commit as one undoable project change. Thumbnail loading must be bounded and must not create a grid of live MapLibre instances.
- Keep names and palette identity original to Print Map Studio. Treat external products only as design research.

## Interaction rules

- Clicking the map/background clears selection and switches the right panel to Project properties.
- Adding a searched place preserves print framing and offers an explicit Show on map action. Search owns its loading/dismissal state, cancels obsolete requests, preserves the query, and announces pending/results feedback. Do not reopen a text keyboard when revealing a place.
- Clicking a layer in the list or canvas selects it and switches the right panel to Layer properties.
- Basemap metadata includes an explicit Map design settings action that navigates to the canonical project/map controls and focuses their heading. Do not duplicate style state inside a separate basemap editor.
- On mobile, tapping a layer in Layers transitions directly to its Properties sheet, without first dismissing the drawer and requiring a second panel-opening action. Selection and panel navigation do not change document history.
- Hovering a layer list row only highlights/previews its map content; hover must not change selection.
- Dragging a layer handle reorders layers. Duplicate/Delete live in the compact layer overflow menu instead of persistent inspector action buttons.
- Layers supports local name filtering and one active keyboard row. Arrow keys and Home/End move focus without selecting or saving; Enter selects, Tab exposes that row's actions and exits the list. Preserve filter state across panel dismissal, but reset it for a new document epoch.
- Filtered drag and Alt+Arrow destinations map to full document order without scrambling hidden layers or moving the basemap. Retire stale gestures when their filter, document or layer snapshot changes. Drop/cancel cleanup must not restore focus over a newer filter or Properties edit; destructive keys must never delete a different selected layer during dragging.
- Layer visibility, lock, rename, delete and reorder update the canvas immediately.
- A content-layer lock protects geometry and deletion, including coordinate fields and imported replacements. Names, appearance, visibility, and duplication remain available. State mutation guards and disabled UI actions must enforce the same contract.
- Pending Road waypoint edits belong to a compatible canonical route and document epoch, not only its ID. Retire obsolete inputs/errors/requests before another route kind or restored snapshot can use them; preserve valid corrections across direct cosmetic edits and selection navigation.
- Unchanged coordinate commits are navigation, not edits. Normalize equivalent text without routing or history changes; canonical waypoint equality must also guard non-field callers. Do not restart pending requests or clear failed corrections on blur; Retry remains explicit.
- Coordinate-only route moves preserve logical segment appearance and curvature, including loop closure aliases. Distinguish these from topology edits. Native gesture cancellation restores canonical geometry and editor state so the next gesture cannot commit canceled work.
- Road matching preserves the source's open/closed intent. Accept a valid canonical closing alias; reject incomplete loops with an accurate explanation rather than silently opening them or adding unmatched connectors. Opening a loop is an explicit, separate action.
- Vertex removal uses the same distinct-point minimum as domain validation and Road request preparation. Disable known-invalid actions with a readable associated explanation; a repeated closing coordinate is not another removable point.
- Elevation data, source choices, settings and numeric drafts belong to an in-session route model, not its visible panel. Collapse/selection must not erase them or repeat requests. Retain last-good same-source data during failed/canceled refreshes; retire obsolete jobs on source, geometry, deletion or project changes. Disclose that profiles are session-only and not saved in project files.
- Elevation sample distances and travel estimates follow the full original route, not straight chords between sparse terrain samples. Reducing terrain requests must not shorten the route.
- Elevation PNG metadata must describe its actual raster scale so the selected physical width survives placement in compatible software.
- Elevation SVG/PNG previews show the complete exported scene, not a reduced chart that hides print defects. Reserve separate font-aware title, axis, summary and attribution rows; account for font weight and fallbacks, and retain long text without clipping or truncation. PDF's separate layout must remain explicit.
- Custom SVG markers use vector source units, not raster minimum-pixel rules. Keep original valid vector bytes portable, derive bounded native textures and capacity from one sizing policy, and require source content that renders in both native and vector output.
- Custom markers disable overridden Color/Shape/Symbol controls with an explanation while preserving the ordinary styling for removal/Undo. Size, label and opacity remain effective. Asset-capacity failures are explicit and retryable; stale uploads must not attach to another layer, epoch or restored asset.
- Bottom toolbar tools have clear active state and keyboard shortcuts.
- An unfinished custom-area outline belongs to the current document session, not the active tool. Changing sources/tools or closing the Area menu suspends it; returning to Draw resumes it. Finish or explicit Cancel in Draw clears it, and opening another project cannot revive the previous draft. Suspended geometry is not rendered as committed map content.
- Route and custom-area drawing start compact on small screens, with visible progress and expandable Settings. Settings remain mounted, explicit collapse restores focus to the Settings control, and the print-frame center stays available for drawing without changing map framing. Keyboard navigation between area-source tabs keeps settings expanded so the tab focus is not removed.
- Avoid modal dialogs for routine edits; use sidebars/popovers.
- Responsive behavior may collapse sidebars into drawers below 900px, but desktop editor quality is the primary target.
- Map failures recover in place: bounded transient resource retries and explicit renderer restart must preserve authoring state, selection, locks, and canonical camera/history. Do not expose incomplete exports or require page reload to recover.
- Export capture must finish restoring live content and actual renderer readiness before another native export starts. Cancellation restores the live map; an obsolete exporter must not alter a replacement renderer.
- Mobile Properties uses a half-height bottom sheet with an undimmed map preview above it. Opening it must not resize the map or change print framing. Keep Close outside the scrolling content, including the color customizer, and preserve the current inspector view when closing/reopening.
