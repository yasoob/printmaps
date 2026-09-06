# Editor UI/UX audit

**Status:** All 49 recorded issues remediated and verified. Audit discovery remains stopped.
**Started:** 2026-09-04.
**Scope:** The editor, including desktop/mobile layout, accessibility, authoring,
information architecture, project persistence, import, export, and recovery.
**Mode:** Recorded issues were fixed individually, addressing root causes and
verifying each before acceptance. Original findings remain below as reproduction
records; their code line references describe the audited version.

## Remediation progress

All 49 recorded issues are verified below. "Verified" requires both appropriate
regression coverage and a successful browser check of the original failure,
where browser reproduction is applicable. This is acceptance of the recorded
findings, not a claim that every possible workflow or device has been audited.

| Issue | Status | Root-cause change | Verification |
|---|---|---|---|
| UX-001 | Verified | Desktop layout owns collapse state; a 44px rail reopens the preserved panel independently of mobile drawers | 7 targeted unit tests; Chromium collapse/resize/mobile regression; typecheck and targeted lint |
| UX-002 | Verified | Shared history controls use the existing viewport state to render touch-sized Project menu commands on mobile | 18 targeted unit tests; Chromium deletion undo/redo and desktop transition; typecheck and targeted lint |
| UX-003 | Verified | User-selected full-name/Rename menu workflow; rename is a coordinated modal using the canonical project-title action | 6 editor-shell Chromium cases; targeted name/file/history tests and modal guards; typecheck and targeted lint |
| UX-004 | Verified | Dedicated document-scoped drawing state; navigation suspends the outline, while explicit Cancel/Finish clear it | 20 targeted unit tests; 8 Chromium shape/layout cases; typecheck, targeted lint, and original-reproduction browser evidence |
| UX-005 | Verified | One validated numeric draft/commit component replaces three silent-rejection implementations | 42 targeted unit tests; 5 Chromium field cases; typecheck and targeted lint |
| UX-019 | Verified with UX-005 | Enter commits through the shared numeric-field contract without remounting the input | Same field cases confirm updated print geometry, retained focus, and one-step Undo |
| UX-006 | Verified | User-selected bottom sheet leaves an undimmed preview without resizing the map; content scrolls independently of Close | 22 unit tests; 3 viewport preview cases plus existing mobile flows; typecheck and targeted lint |
| UX-010 | Verified with UX-006 | One shared visibility-aware focus utility excludes hidden/disabled/non-tabbable controls from the mobile trap | Forward/reverse customizer focus loops at 320, 390, and 844px; focus-utility and recovery tests |
| UX-007 | Verified | Shared touch-target size expands reported controls and their grid/toolbar tracks on coarse-pointer devices | Phone/tablet dimensions and touch interactions; existing geometry-drag cases; typecheck and targeted lint |
| UX-008 | Verified | Explicit modal state and a shared semantic keyboard-scope guard protect canvas, history, and route-draft commands | 36 targeted unit cases; browser modal/menu lifecycle plus editor-shell regressions; typecheck and targeted lint |
| UX-009 | Verified | User-selected geometry/deletion lock contract is enforced at store, action-controller, coordinate-field, and menu boundaries | Store permission matrix, straight/arc styling cases, and browser locked-place/route workflow; typecheck and targeted lint |
| UX-011 | Verified | Give search priority in the narrow toolbar while retaining labeled, full-size panel buttons | 320/390px readability and target measurements; mobile/layout regressions; typecheck and targeted lint |
| UX-012 | Verified | Shared disclosure model starts drawing compact, preserves settings/drafts, and makes collapse reversible and focus-safe | 37 unit cases; narrow/landscape print-center hit tests; existing authoring/layout/shell regressions; typecheck and lint |
| UX-013 | Verified | Keyboard coordinate entry shares the document-scoped outline owner; explicit input source preserves the entry workflow | 27 unit cases; 10 Chromium cases including zero-pointer desktop/320px creation; typecheck and targeted lint |
| UX-014 | Verified | User-selected direct Layers-to-Properties transition reuses the central panel controller | 15 unit cases; 13 mobile/shell browser cases plus advanced/elevation flows; typecheck and lint |
| UX-015 | Verified | Explicit basemap-to-map-design navigation preserves metadata controls and uses the existing settings owner | Selection/render-boundary unit coverage; desktop/mobile live style navigation; typecheck and lint |
| UX-016 | Verified | Epoch-scoped unfinished-work signals drive truthful status and navigation/replacement warnings; completed-document persistence is unchanged | Worker: 104 unit cases, 41 browser cases; parent: 47 unit and 10 browser cases after review fix; typecheck/lint |
| UX-017 | Verified | Shared interaction blue now provides 4.804:1 contrast against white without per-button overrides | Computed-color browser checks cover default/hover, active tools, and mobile pseudo backgrounds; token/type/lint checks |
| UX-018 | Verified | Resolve the physical Digit1 key as well as existing semantic key events | Real Shift+Digit1 browser events, input/lock/modal guards, 12 unit cases, typecheck and lint |
| UX-020 | Verified | Search-created places get explicit confirmation and Show on map without automatic reframing | Desktop/mobile reveal tests, current lock/visibility and stale-entity unit cases, durable POI regression |
| UX-021 | Verified with search work | One search state machine coordinates dismissal, cancellation, query retention, and active options | Outside-click, keyboard-departure, late-response, and active-descendant regressions |
| UX-022 | Verified with search work | Visible pending feedback and a stable live region reflect actual request state | Controlled delayed-response browser tests, busy/focus assertions, typecheck and lint |
| UX-023 | Verified | Bound header grid tracks and allow the title to shrink rather than displacing document actions | Four-width maximum-title browser cases during/after editing; header regressions, token/type/lint checks |
| UX-024 | Verified | Bounded resource recovery and explicit renderer lifetimes preserve editing state, lock, canonical camera, commands, and truthful export readiness | 222 unit cases; 28 Chromium workflows including final fault/lock/coherence cases; types/lint |
| UX-025 | Verified | Shared replacement transaction protects completed/restored work; backup, cancellation, and explicit replacement remain separate | 41 unit cases; 27 Chromium file/replacement/draft cases; typecheck and targeted lint |
| UX-026 | Verified | Parser-backed atomic admission with cached immutable fragments and explicit authoring/preview rejection handling | 399 scoped unit cases; 24 Chromium workflows; independent review finding corrected and directly reproduced |
| UX-027 | Verified | Capture recovery data at load; separate backup, safe offline continuation, and guarded discard/retry | 68 unit cases; 21 Chromium workflows, including keyboard-scrollable short-screen recovery and unobstructed offline search |
| UX-028 | Verified | Retire conflicted writers and offer independent backup/cancel/owned saved-version loading | 77 unit cases; 20 Chromium workflows; parent source, evidence, and manifest review |
| UX-029 | Verified | Exact cached UTF-8 admission, compact download fallback, and result-aware scalar/native rollback | 330 unit cases; 50 Chromium cases validated; independent review clear; exact-cap artifact independently measured |
| UX-030 | Verified | One owned review transaction for chooser/drop, fit/keep, cancellation, and stale-result feedback | 143 shared unit cases; 58 distinct browser cases validated; parent source/visual review and 25 focused cases |
| UX-031 | Verified with UX-030 | One string-aware validation result for fields, submit eligibility, and application | Blank/whitespace/zero/range cases; direct commit rejection; parent 12px legibility and phone follow-through |
| UX-032 | Verified | Shared PDF plan drives early eligibility, readable guidance, and the execution guard; bounded export layout preserves actions | 59 unit cases; 8 Chromium export/preflight cases; real corrected-size PDF and short-screen keyboard checks |
| UX-033 | Verified | Lookup produces reviewable suggestions; explicit selection/correction/exclusion precedes atomic admission | 141 unit cases after parent corrections; 60 distinct browser cases validated; independent review cleared |
| UX-034 | Verified | Shared error-first DOM outlets prevent overlap while preserving each workflow's status owner | 25 unit cases; 17 Chromium file/import cases; 1440/390/320px priority, dismissal, focus and visual checks |
| UX-035 | Verified with UX-033 | One epoch-owned list model retains both modes and guards every exit; mode-owned messages remain relevant | Buffer, replay, cancellation, stale target, and real Extend start/end cases; separate preservation evidence |
| UX-036 | Verified | Canonical New project command shares outgoing-work/backup protection and retires older file requests | 21 unit cases; 19 Chromium workflows, including default reset, restoration, pending IO, drafts and 320px |
| UX-037 | Verified | Semantic/epoch ownership retires obsolete Road values, errors and requests while compatible corrections survive | 110 unit cases; 15 Chromium cases; parent 26-case rerun, source review and native/JSON evidence |
| UX-038 | Verified | Shared coordinate-move semantics preserve logical legs; native preview/gesture cancellation respects canonical ownership | 318 unit cases; 36 Chromium cases; pointercancel review correction and independent artifact comparisons |
| UX-039 | Verified | Per-project, epoch-owned profile sessions retain data/settings and own asynchronous work independently of view visibility | 54 combined unit cases; 14 Chromium cases; independent review clear; source and output evidence inspected |
| UX-040 | Verified with profile work | Keep original-route cumulative sample distances and total rather than recomputing sparse chords | Right-angle, switchback and antimeridian regressions; actual UI travel estimates and SVG axis agree with original distance |
| UX-041 | Verified | Route-aware admission accepts the closing alias and preserves topology; incomplete loops fail truthfully without invented connectors | 140 worker unit and 24 browser cases; parent source/hash/native review and nine matching browser cases |
| UX-042 | Verified | Shared complete preview/SVG/PNG scene uses font-aware bands and weighted font/fallback measurements | 122 unit and 18 browser cases; 123 actual glyph cases; title-clipping review correction and independent re-review clear |
| UX-043 | Verified | Equal scalar and canonical waypoint commits are no-ops without restarting pending requests | 9 original failures reproduced; 40 unit and 6 Chromium cases; actual request counts and one-step Undo inspected |
| UX-044 | Verified | Shared minimum/removal contract drives domain validation, Road preflight and inspector eligibility | 105 scoped unit cases; Straight/Arc/Road and 320px browser removal/Undo; nine matching regressions |
| UX-045 | Verified | Shared PNG metadata helper encodes the actual 12 pixels/mm raster scale | Native 50/220/300mm PNG dimensions, 12,000 px/m, CRCs and unchanged image data independently inspected |
| UX-046 | Verified | Format-aware source validation and bounded vector decoding preserve original SVG data and coherent native/print sizing | 186 distinct shared unit and nine browser cases; namespace review correction; actual SVG/PNG paint measured |
| UX-047 | Verified with marker work | Disable overridden controls with an explanation while preserving dormant styling | Desktop/mobile applicability, size/label/opacity, removal and Undo/Redo; 12px guidance and 44px action |
| UX-048 | Verified with marker work | Canonical admission reports real capacity failures; upload jobs belong to epoch/layer/current asset | Actual count/encoded/decoded/exact portable caps; byte-identical rejected downloads and successful retries |
| UX-049 | Verified | Epoch-owned filtering and roving row focus preserve canonical ordering; drag cleanup owns destructive-key and delayed-focus boundaries | 120 unit and 40 integrated browser cases, no exclusions; parent nine-case rerun and native/document evidence; independent re-review clear |

## Method and evidence

- Exercise realistic tasks in the current worktree and trace observed behavior to
  its implementation.
- Separate browser-reproduced findings from code-confirmed findings and unresolved
  hypotheses. Do not count hypotheses as confirmed issues.
- Give each finding a stable ID, severity, reproduction steps, user impact,
  evidence, and a proposed improvement.
- High: blocks a primary task, risks lost work, or excludes an input modality.
  Medium: materially confusing, error-prone, or unnecessarily difficult.
  Low: localized friction or weak communication with a straightforward workaround.
- Screenshots and diagnostic artifacts are saved in the audit session's artifact
  directory. Code references are relative to the repository root.

## Environment and limitations

- Source: `yasoob/printmaps`, branch `yasoob-editor-ux-audit`.
- Audit origin: `http://127.0.0.1:4193/editor/`.
- A clean local development environment does not include a Mapbox token.
  Provider-configuration limitations will not be reported as production outages.
- Existing automated tests are supporting evidence, not a substitute for
  examining the user experience.
- Browser: Chromium 151 on macOS; desktop 1440 x 900 and mobile-sized 390 x 844
  viewports examined so far. Mobile viewport observations are not a claim of
  testing physical iOS/Android devices.
- React Scan is enabled by default in development. Its diagnostic overlay is
  being disabled for subsequent screenshots; it is not counted as a product bug.
- Search-result interaction probes use an isolated local fixture origin with a
  nonfunctional dummy token and intercepted, deterministic Mapbox responses.
  These prove editor behavior, not real provider accuracy or availability.
- Startup/rendering spot checks also succeeded in Firefox and WebKit (iPhone 13
  emulation). These are not full cross-browser coverage or physical-device tests.

## Coverage ledger

| Area | Status | Next focus |
|---|---|---|
| First use and desktop shell | First pass reviewed, including fresh-project gap | Returning-user guidance |
| Project/page/style controls | First pass reviewed | Additional presets and settings combinations |
| Search and map navigation | Reviewed with controlled results | Live-provider result relevance remains untested |
| Places and markers | Core and custom-asset admission/controls reviewed | Custom-asset output fidelity and recovery |
| Routes | Draft, advanced editing, and elevation passes reviewed | Further geometry/provider combinations |
| Areas | Custom drawing and catalogue recovery reviewed | Travel-time area details |
| Layers and history | Core controls and 300-place navigation reviewed | Long-distance reorder and bulk-management workflows |
| Import and spreadsheets | Limits, review, and paste-recovery pass reviewed | Additional file formats and partial failures |
| Project files and autosave | Replacement, corruption, and conflicts reviewed | Additional storage/browser combinations |
| Export | Preflight and profile-output passes reviewed | Full output-fidelity matrix |
| Mobile and tablet | Phone layouts plus 1024px coarse-pointer marker drag reviewed | Tablet route/area gestures and shortened viewport |
| Keyboard and accessibility | Initial focus/contrast/shortcut pass reviewed | Screen-reader testing remains outstanding |

## Issue index

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| UX-001 | Medium | Desktop Collapse layers button does nothing | Browser + code |
| UX-002 | High | Mobile has no touch-accessible document Undo/Redo | Browser + code |
| UX-003 | Medium | Phone layout removes project identity and renaming | Browser + code |
| UX-004 | High | Changing area mode/tool silently destroys the draft | Browser + code |
| UX-005 | Medium | Invalid project numeric values silently revert | Browser + code |
| UX-006 | Medium | Mobile style editing hides the map being styled | Browser + code |
| UX-007 | Low | Touch layouts retain small desktop hit targets | Browser + code |
| UX-008 | Medium | Global tool shortcuts change the editor behind modal dialogs | Browser + code |
| UX-009 | Medium | Locked layers can still be moved by fields and deleted by menu | Browser + code |
| UX-010 | High | Mobile color customizer breaks the keyboard focus loop | Browser + code |
| UX-011 | High | 320px layout reduces the search input to four pixels | Browser + code |
| UX-012 | Medium | Authoring cards cover the print area on small/landscape phones | Browser + code |
| UX-013 | High | Custom area creation has no keyboard-operable point-entry path | Browser + code |
| UX-014 | Low | Mobile layer actions require repeated trips between drawers | Browser + code |
| UX-015 | Medium | Selecting the basemap hides the map-design controls | Browser + code |
| UX-016 | High | Autosave claims all changes are saved while route drafts are lost on reload | Browser + code |
| UX-017 | Medium | White primary-button text fails normal-text contrast | Browser measurement |
| UX-018 | Low | Advertised Shift+1 shortcut fails on a standard US keyboard | Browser + code |
| UX-019 | Low | Enter does not apply edited page dimensions | Browser + code |
| UX-020 | Medium | Search-created places can be invisible outside the current view | Browser with mocked search |
| UX-021 | Low | Search results stay open after clicking the map | Browser with mocked search |
| UX-022 | Low | Search gives no visible or announced loading feedback | Browser with mocked delay |
| UX-023 | High | A valid long project title pushes header actions off-screen | Browser + code |
| UX-024 | High | One failed map tile leaves the editor permanently in an error state | Browser fault injection + code |
| UX-025 | High | Opening another project overwrites the only local copy without confirmation | Browser + code |
| UX-026 | High | Accepted edits produce projects that cannot autosave or reopen | Browser + code |
| UX-027 | High | Damaged-draft recovery offers only deletion and can trap the editor | Browser fault injection + code |
| UX-028 | High | Cross-tab conflict guidance leads users to discard their unsaved version | Browser + code |
| UX-029 | Medium | A valid imported boundary can become impossible to download as a project | Browser + serialized-size measurement |
| UX-030 | Medium | Single-file import behavior changes depending on chooser versus drag | Browser + code |
| UX-031 | Medium | Blank import width is flagged invalid but creates zero-width routes | Browser + downloaded document |
| UX-032 | Medium | PDF allows a predictably failing download, then shows raw memory numbers | Browser + code |
| UX-033 | Medium | Address spreadsheets commit the first geocoding match without review | Code-confirmed |
| UX-034 | Medium | An old import-success notice completely covers later file errors | Browser + layout measurement |
| UX-035 | Low | Switching spreadsheet modes erases the pasted draft | Browser + code |
| UX-036 | Medium | There is no explicit way to start a fresh project | Browser + code |
| UX-037 | High | A failed Road edit contaminates later Arc coordinates after conversion | Browser fixture + code |
| UX-038 | Medium | Moving a closed-route anchor destroys adjacent styling and bends | Browser + document comparison |
| UX-039 | Medium | Collapsing Advanced discards elevation data and profile customization | Browser with mocked elevation |
| UX-040 | Medium | Elevation distances and travel estimates cut across route bends | Real module + controlled terrain |
| UX-041 | Medium | Closed-loop road matching is offered but cannot preserve normal loop results | Browser + controlled store execution |
| UX-042 | Medium | Exported elevation-profile summary overlaps its axis labels | Browser output + geometry measurement |
| UX-043 | Medium | Tabbing through unchanged Road coordinates triggers rerouting | Browser fixture + code |
| UX-044 | Low | Minimum-size closed routes offer a Remove action that silently does nothing | Browser + code |
| UX-045 | Low | Elevation PNG omits the physical print size selected in the UI | Downloaded PNG metadata |
| UX-046 | Medium | Scalable SVG markers are rejected by a raster-style minimum size | Browser + code |
| UX-047 | Medium | Custom markers leave ineffective appearance controls enabled | Browser + identical rendered pixels |
| UX-048 | Medium | Exceeding custom-marker capacity silently ignores a valid upload | Browser fixture + downloaded document |
| UX-049 | Medium | Large layer lists have no filter or compact keyboard navigation | Browser + measured focus order |

## Detailed findings

### UX-001 - Desktop Collapse layers button does nothing

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. The workspace view now owns desktop
collapse state, separate from mobile drawer dismissal and project history.
The panel collapses to a keyboard-operable 44px reopening rail while preserving
its mounted list and selection. MapLibre's existing container ResizeObserver
resizes the same map instance; no remount, synthetic window resize, or extra
observer was introduced.

**Regression coverage:** `tests/unit/app/app-panel-layout.test.tsx`,
`tests/unit/app/render-boundaries.test.tsx`, and the desktop Layers collapse
case in `tests/e2e/editor-shell-actions.spec.ts`. The browser case checks actual
canvas growth, unchanged camera/selection/history, retained map identity, and
independent mobile open/close behavior.

**Reproduce:** At 1440 x 900, click the collapse icon in the Layers header.

**Actual:** Nothing changes. The panel bounding box before and after is
`x=0, y=44, width=240, height=856`; no extra canvas space becomes available.
The button is enabled and explicitly named "Collapse layers".

**Impact:** A visible workspace-management affordance is a dead end, particularly
when trying to gain room for detailed map editing.

**Expected / improvement:** Implement a desktop collapsed state and reopening
affordance, or remove the nonfunctional control until supported.

**Code:** `src/app/components/LayersSidebar.tsx:159-169`;
`src/app/hooks/useMobilePanels.ts:44-53`. The callback only clears mobile state.

### UX-002 - Mobile has no touch-accessible document Undo/Redo

**Severity:** High. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. The shared history component now renders
the same store commands and enabled states as mobile Project menu items.
It uses the existing mobile-panel viewport state rather than introducing a
second breakpoint observer or leaving hidden menu items in keyboard navigation.
Desktop retains its direct toolbar controls.

**Regression coverage:** The mobile history case in
`tests/unit/app/studio-header-actions.test.tsx` checks enabled-state changes
and command behavior. Its Chromium counterpart in
`tests/e2e/editor-shell-actions.spec.ts` deletes a layer using the mobile
drawers, restores/removes it with Undo/Redo, checks the 44px menu target and
focus return, and confirms the desktop menu does not duplicate history actions.

**Reproduce:** Make an edit such as changing page orientation. At 390 x 844, try
to undo it using the top bar, Project menu, Layers, or Properties.

**Actual:** History buttons are hidden below 900px. Project actions contain only
Open project, Download project, and Import map data. There is no replacement
document-history action. Draft-route "Undo point" is not document undo.

**Impact:** Touch-only users cannot recover from an accidental layer deletion or
reverse a style/page edit without manually reconstructing the previous state.
Keyboard shortcuts do not provide a touch-only alternative.

**Expected / improvement:** Keep compact Undo/Redo controls available or expose
them in a consistently reachable mobile action menu.

**Code:** `src/styles.css:1822-1832`;
`src/app/components/StudioHeader.tsx:71-80`;
`src/app/hooks/useEditorShortcuts.ts:99-116`.

### UX-003 - Phone layout removes project identity and renaming

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. Per the user's choice, the mobile Project
menu shows the complete current name and a Rename command, without adding a
header row. A dedicated rename dialog is registered with the existing modal
coordinator and calls the canonical title action. It does not click hidden
controls or introduce a separate copy of the saved project name.

**Regression coverage:** Header unit cases cover cancellation, blank-name
feedback, undo, and blocking document delete/history shortcuts while the dialog
is open. The Chromium phone case covers focus/selection, Cancel and Escape,
120-character name wrapping at 320px, Undo, and focus return to Project.
The full six-case editor-shell browser file passed. A separate touch-context
check confirmed the focused 16px name field and unchanged canvas dimensions.

**Artifacts:** `ux-fix-003-mobile-project-menu.png`,
`ux-fix-003-rename-dialog.png`, `ux-fix-003-browser.json`.

**Reproduce:** Open an existing or new document at 390 x 844. Look for its title or
a rename action in Project and Properties.

**Actual:** `.project-title` is hidden at widths <=560px. The Project menu has no
rename action and the inspector shows only the generic heading "Project".
The sole title-edit trigger is the hidden button.

**Impact:** Phone users cannot name their document or confirm which document is
currently open before downloading/replacing it.

**Expected / improvement:** Preserve a compact title or show the current name and
a Rename action in the Project menu.

**Code:** `src/styles.css:2071-2073`;
`src/app/components/ProjectTitleEditor.tsx:27-48`.

### UX-004 - Changing area mode/tool silently destroys the draft

**Severity:** High. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. `useShapeDrawingDraft` owns the drawing
points and last source for the current document session. Tool activation no
longer mutates that state. Changing tabs/tools or closing the Area menu
suspends the outline and hides its preview; returning to Draw restores the
exact geometry. Explicit Cancel in Draw and successful Finish clear it.
Closing another area source does not discard the suspended outline.

The draft's document epoch is independent of the active tool's epoch, so
opening another project and then activating tools cannot revive old points.
This is session-local preservation; reload/autosave recovery remains pending
under UX-016 and is not claimed fixed here.

**Regression coverage:** Shape-authoring unit cases exercise source/tool/menu
transitions, another route's discard dialog, point undo, explicit cancellation,
finishing, and replacement-project isolation. Chromium cases reproduce
preservation at 1440px and 390px and cover existing shape editing, vector export,
and responsive dock behavior. A separate real-browser replay confirmed retained
three-point geometry and zero points after opening a fresh project.

**Artifacts:** `ux-fix-004-resumed-outline.png`, `ux-fix-004-browser.json`.

**Reproduce:** Choose Area > Draw. Click three map points. Switch to Boundaries,
then back to Draw. Separately, repeat the three points, switch to Select, and
return to Area > Draw.

**Actual:** Both paths change "3 vertices" to "0 vertices" without a confirmation
dialog. Draft points are not committed document history, so document undo cannot
recover them. Route drafting, in contrast, has a discard-confirmation flow.

**Impact:** A user exploring another mode or temporarily trying to inspect the
map loses their unfinished outline with one click.

**Expected / improvement:** Preserve each draft across mode changes, or ask to
discard it using the same recoverable interaction pattern as routes.

**Code:** `src/app/hooks/useCanvasShapeAuthoring.tsx:67-72,104-112`;
`src/app/hooks/useCanvasWorkspaceInteractions.ts:31-61`;
contrast `src/app/hooks/useCanvasRouteAuthoring.ts:112-125`.

### UX-005 - Invalid project numeric values silently revert

**Severity:** Medium. **Evidence:** Browser-reproduced for page width;
code-confirmed for the related fields.

**Resolution:** Verified, 2026-09-04. Page dimensions, bearing, pitch, and text
scale now share `ValidatedNumberField`. Invalid drafts show their specific
constraint; blur restores the saved value with a persistent, associated
"Previous value kept" explanation. Correction or Escape clears the error.
Canonical value/document changes reset buffered edits without remounting the
input or reviving an old draft. The previous intentional behavior of marking
an explicitly edited page dimension Custom is preserved, even if its number
matches the prior preset.

**Regression coverage:** 42 targeted unit cases cover page/camera/text-scale
behavior, scrubbing, reset cycles, and render boundaries. Five Chromium cases
check each numeric field's visible error, associated description, rejection
without history mutation, correction, focus, and Undo.

**Reproduce:** Enter `0` in Page width, then move focus to Page height. Similar
out-of-range edits are possible for bearing, pitch, and text scale.

**Actual:** Width becomes `aria-invalid="true"` while editing, then silently
returns to `297` on blur. No visible error or alert explains the minimum.
Camera and text-scale fields use the same revert-without-message behavior.

**Impact:** Users cannot tell whether their entry was ignored, rounded, or
rejected, and are not told the acceptable range.

**Expected / improvement:** Display a concise associated validation message and
retain the draft until corrected, or explicitly announce a justified correction.

**Code:** `src/app/components/ProjectProperties.tsx:15-60,70-108,111-144`.

### UX-006 - Mobile style editing hides the map being styled

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. The user selected a bottom sheet with a
live undimmed preview. Mobile Properties now occupies the lower half of the
viewport without resizing the canvas, changing camera settings, or changing
print-frame bounds. Its content scrolls independently of the always-available
Close control. Closing/reopening preserves the current inspector subview and
customization state.

**Regression coverage:** Browser cases at 320px, 390px, and landscape 844px check
the visible preview area, transparent backdrop, unchanged canvas/frame/camera,
live style changes, non-overlapping header controls, and retained settings.
Existing mobile geometry checks now wait for the panel's focus handoff instead
of comparing parent/child coordinates in different animation frames.

**Artifacts:** `ux-fix-006-live-preview.png`, `ux-fix-006-browser.json`.

**Reproduce:** At 390 x 844, open Properties > Map style > Customize colors and
adjust a map color or tone.

**Actual:** The modal inspector is approximately 320px wide, leaving only a
70px dimmed strip of the map. The canvas is inert. Customize map hides the drawer
close button, so the explicit control path to see the result is Back to project
properties, then Close properties, then reopening Properties to iterate.
The backdrop is another dismissal path, but is not a usable live preview.

**Impact:** A visual tuning task becomes repeated open/edit/close/inspect cycles
instead of direct feedback; precise changes cannot be judged in context.

**Expected / improvement:** Use a resizable/collapsible bottom sheet, a persistent
preview region, or a press-and-hold preview action. Keep an obvious close/preview
action in the customization view.

**Code:** `src/styles.css:1868-1895,1937`;
`src/app/components/CanvasWorkspaceView.tsx:96-100`;
`src/app/components/MapStyleCustomizer.tsx:168-218`.

### UX-007 - Touch layouts retain small desktop hit targets

**Severity:** Low. **Evidence:** Browser-measured; code-confirmed.

**Resolution:** Verified, 2026-09-04. A shared touch-target token gives coarse-
pointer devices 44px color inputs, slider targets, layer actions, map tools,
and native navigation buttons. Color/layer grid tracks and toolbar height grow
with the controls, avoiding overlapping hit areas; visible swatches stay compact
inside the larger input bounds.

**Regression coverage:** Phone 390px and tablet 1024px cases measure targets and
layer-row non-overlap, then use touch to reset colors and adjust contrast.
Existing trusted touch drags for places, routes, and areas also pass.

**Reproduce:** At 390 x 844, open Properties > Map style > Customize colors.

**Actual:** The eleven color inputs are 24 x 24 CSS pixels; Contrast and Detail
range inputs are 16px high. Mobile button enlargement does not enlarge these
inputs. The color-name text is a separate span, not a wrapping clickable label.

**Impact:** Precise color/slider manipulation is unnecessarily difficult by
touch, especially compared with the adjacent 44px buttons.

**Expected / improvement:** Provide at least a 44px interactive envelope around
the inputs without necessarily enlarging the visible swatches.
This is a touch-usability finding, not a blanket WCAG conformance claim.

**Code:** `src/styles.css:1038,1055-1061,1921-1925`;
`src/app/components/MapStyleCustomizer.tsx:95-112`.

**Tablet extension, pass 7:** A 1024 x 768 coarse-pointer/touch context uses
desktop chrome: layer visibility/lock targets are 24 x 24px, map tool buttons
32 x 32px, and Zoom in 29 x 29px. In the same context the map's place-move handle
correctly enlarges to 44 x 44px and successfully responds to a touch drag.
Touch sizing is inconsistent because most chrome enlargement depends on the
below-900px viewport breakpoint, rather than the input modality.
**Additional code:** `src/styles.css:235-239,1687-1713,1822-1829,1917-1948`.
**Artifacts:** `ux-layers-tablet-results.json`, `ux-tablet-touch-targets.png`.

### UX-008 - Global tool shortcuts change the editor behind modal dialogs

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. Canvas and route-draft keyboard dispatch
now receive the editor's explicit modal state, including recovery and internal
route-discard boundaries. A shared semantic target guard also keeps menu,
dialog, listbox, and editable-control keystrokes with their current owner.
History/deletion use the same target rule instead of duplicating narrower
typing-only checks.

**Regression coverage:** Unit cases cover modal focus, document-targeted key
events, menu typeahead, route-menu Escape, and discard dialogs. The browser
case checks Export, Project menu, Properties, Rename, and route discard, then
confirms tool shortcuts resume after dismissal. The existing editor-shell
browser cases also pass.

**Reproduce:** Open Export. Focus Close export and press `P`.

**Actual:** The export dialog remains open, but the underlying canvas changes to
Place (`data-active-tool="pin"`). Closing the dialog reveals a different tool
than the one with which the user entered it.

**Impact:** Keystrokes intended for the active modal alter background interaction
state, violating the modal boundary and making the next map click surprising.

**Expected / improvement:** Suspend global canvas/tool shortcuts while any modal
surface or mobile modal drawer is active. Continue to allow appropriate dialog
keyboard behavior.

**Code:** `src/app/components/CanvasWorkspace.tsx:46-88`. Its document listener
has typing/modifier guards but no modal guard, unlike the history shortcuts.
**Artifact:** `ux-shortcuts-through-export.json`.

### UX-009 - Locked layers can still be moved by fields and deleted by menu

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. The user chose geometry/deletion protection
while keeping name/style changes available. Place coordinate fields and
Replace/Delete menu actions now reflect that contract, and the store rejects
locked coordinate/deletion mutations without changing history. The selected-
delete controller also guards stale callbacks. Existing route/shape geometry
guards remain in force. Advanced route styling no longer inherits geometry
disabling, and the inspector explains the lock's scope.

**Regression coverage:** Store cases cover places, routes, and areas; UI cases
cover straight and arc route styling. The browser workflow verifies disabled
location/deletion, editable name/color/advanced marker styles, unchanged locked
geometry, and successful geometry editing/deletion after unlocking.

**Reproduce:** Create a place, lock it, edit its longitude in Properties, then
open Layer menu > Delete layer.

**Actual:** Longitude changes from approximately `16.35` to `17` even while the
lock remains enabled. Replace layer data is disabled, but Delete layer is enabled
and immediately removes the locked layer. Backspace/Delete keyboard deletion
explicitly respects the lock.

**Impact:** The same lock means different things depending on input path. A user
cannot rely on it to protect content from edits or deletion.

**Expected / improvement:** Define the lock contract and apply it consistently
to canvas, coordinate fields, menus, and keyboard commands. If the intended
contract is only "prevent dragging", label it that way rather than "Locked".

**Code:** `src/app/components/LayerMenu.tsx:46-51`;
`src/app/components/LayerProperties.tsx:45-56`;
`src/app/storeLayerActions.ts:120-132,240-247`;
`src/app/hooks/useEditorShortcuts.ts:45-46`.
**Artifacts:** `ux-locked-layer-actions.json`, `ux-locked-deletion.json`,
`ux-locked-layer-menu.png`.

### UX-010 - Mobile color customizer breaks the keyboard focus loop

**Severity:** High. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified with UX-006, 2026-09-04. The customizer no longer hides
its Close control. The panel trap now uses shared visibility-aware tab-stop
discovery rather than collecting every enabled-looking element. Hidden and
inert ancestors, disabled fieldsets, hidden inputs, and negative tab indices
are excluded; accessible native controls represented visually by siblings
remain focusable. Autosave focus restoration reuses the same eligibility rule.

**Regression coverage:** Browser tests wrap from the last color to Close and
back at three mobile viewport sizes. Unit cases cover hidden/disabled controls,
textareas, links, and transparent native checkboxes; recovery-focus and existing
mobile action tests also pass.

**Reproduce:** At 390 x 844, open Properties > Map style > Customize colors.
With no custom overrides, focus Label halo color and press Tab. Separately,
focus Back to project properties and press Shift+Tab.

**Actual:** Forward Tab remains stuck on Label halo color. Reverse Tab escapes
the dialog to the background "Close open panel" button.

**Cause:** The focusable-element query includes the hidden Close properties
button. The forward-wrap handler prevents default and tries to focus that
invisible first element; the first visible element is not treated as the start.

**Impact:** Keyboard users cannot navigate the modal in a predictable loop.
The visual close affordance is also absent in this subview.

**Expected / improvement:** Derive the trap from visible, enabled, non-inert
focusable elements, or use the same robust modal primitive as other dialogs.

**Code:** `src/app/hooks/useMobilePanels.ts:26-30,65-83`;
`src/styles.css:1937`.
**Artifacts:** `ux-customizer-focus-cycle.json`,
`ux-customizer-reverse-focus.json`.

### UX-011 - 320px layout reduces the search input to four pixels

**Severity:** High. **Evidence:** Browser-measured and visually reproduced.

**Resolution:** Verified, 2026-09-04. Below 560px, secondary panel commands use
recognizable icon buttons while retaining accessible names and titles. Search
keeps at least 100px of editable text width in the same row, with 44px input
and submit hit areas. The bordered search and panel-button envelopes align
without adding a new toolbar row.

**Regression coverage:** 320px/390px cases measure the input and buttons,
confirm "San Francisco" fits without internal scrolling, and exercise both
panels. Existing mobile and canvas-layout cases cover the surrounding geometry.

**Reproduce:** Open the editor at 320 x 568 and type a place into the top search.

**Actual:** Layers and Properties occupy fixed-content columns. The remaining
search input measures only **3.92 CSS pixels wide**, between its search icon and
28px submit button. Even its placeholder is reduced to approximately one letter.
There is no horizontal page overflow, so an overflow-only check misses the issue.

**Impact:** A primary navigation task is functionally unreadable: users cannot
see, review, or meaningfully edit their place/address query.

**Expected / improvement:** Give search its own full-width row, collapse the
panel buttons to icons, or open a dedicated search surface at narrow widths.

**Code:** `src/styles.css:312-324,1897-1915`.
**Artifacts:** `ux-320-search.json`, `ux-phone-320.png`,
`ux-phone-320-search-text.png`.
The width problem is independent of the missing local provider token.

### UX-012 - Authoring cards cover the print area on small/landscape phones

**Severity:** Medium. **Evidence:** Browser-measured and visually reproduced.

**Resolution:** Verified, 2026-09-04. The user chose compact-first route/custom-
area drawing. A shared disclosure model and Settings control now separate
configuration from drawing without unmounting settings or changing map framing.
Compact cards retain visible progress, Undo point, and Finish; expanded cards
have an explicit collapse control that restores Settings focus. Area-source
keyboard navigation keeps its tabs expanded instead of hiding the focused tab.

**Regression coverage:** 320 x 568 and 844 x 390 cases hit-test and click the
actual print-frame center before the first route/area point, verify retained
settings/focus, and finish an area. Existing draft-preservation, route export,
auto-hide, mobile, and canvas-layout cases pass. On the 320px reproduction,
the Area card is now 184 x 90px instead of 184 x 339px; the print-frame center
is directly reachable.

**Artifacts:** `ux-fix-012-route-compact.png`, `ux-fix-012-area-compact.png`,
`ux-fix-012-browser.json`.

**Reproduce:** At 320 x 568, choose Area > Draw. At 844 x 390, choose Route.

**Actual:** The small-phone Area card is 184 x 339px over a 237 x 335px print
frame, covering most of the region the user needs to click. In landscape, the
400 x 204px Route card covers almost the entire 157 x 221px portrait print frame.
The panels cannot be moved; the Area card has no collapse-to-drawing state.

**Impact:** Users must pan around an overlay to author points in their intended
print region, then restore framing, rather than directly draw what they see.
Closing the Area card discards its draft (UX-004), so it is not a safe workaround.

**Expected / improvement:** Separate setup from drawing with compact retained
controls, use a collapsible sheet, or reserve a visible canvas region above it.

**Code:** `src/styles.css:272-300,1962-1969,2064-2068`;
`src/app/components/ShapeDrawingPanel.tsx:61-80`.
**Artifacts:** `ux-320-area.json`, `ux-phone-320-area.png`,
`ux-landscape-route-layout.json`, `ux-landscape-route.png`.

### UX-013 - Custom area creation has no keyboard-operable point-entry path

**Severity:** High. **Evidence:** Browser surface inspection; code-confirmed.

**Resolution:** Verified, 2026-09-04. An accessible coordinate-pair form feeds
the same document-scoped draft as map clicks. It validates bounds and duplicate
points, retains raw values for correction, and returns focus for the next point.
Coordinate submissions keep settings expanded; map input retains compact
drawing behavior. Scoped Enter/Undo/Escape shortcuts finish, correct, or suspend
the outline without intercepting text, buttons, menus, or modals.

**Regression coverage:** Keyboard-only desktop and 320px browser cases create
and finish the expected polygon with zero pointer actions, then Undo/Redo it.
They also cover invalid input, correction, settings/source preservation,
explicit cancellation, and modal isolation. Existing compact drawing, draft
preservation, export, and shape editing cases pass.

**Evidence:** `ux-fix-013-results.json` contains the exact file manifest,
commands, screenshots, and limitations. Browser evidence is under
`ux-fix-013-playwright-final/`.

**Reproduce:** Choose Area > Draw and attempt to define a new custom outline
using only the keyboard.

**Actual:** The panel instructs users to click around the map and offers only
Undo point, Cancel, and Finish. No coordinate-entry or keyboard "add point"
action exists. The area click handler receives pointer map clicks. Existing
shape vertex fields are available only after a shape already exists.
Escape from the Area tool also does nothing, unlike Route.

**Impact:** A keyboard-only user cannot perform the custom-area creation task.
Importing prebuilt geometry or choosing a catalogue boundary is not an equivalent
way to author an arbitrary outline.

**Expected / improvement:** Offer coordinate-based point entry or a keyboard
crosshair/add-point interaction and consistent finish/cancel shortcuts.

**Code:** `src/app/components/ShapeDrawingPanel.tsx:61-80`;
`src/app/components/CanvasWorkspace.tsx:102-115`;
`src/map/MapCanvasLifecycle.ts:186,296`;
`src/app/hooks/useCanvasShapeAuthoring.tsx`.
**Artifact:** `ux-area-escape.json`.

### UX-014 - Mobile layer actions require repeated trips between drawers

**Severity:** Low. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. Per the user's choice, a mobile layer tap
selects the layer and directly opens its Properties sheet. The existing panel
controller owns the transition and focus handoff; there is no intermediate
close/reopen state, duplicate timer, or synthetic trigger click. Desktop
selection is unchanged, and navigation does not create a document-history entry.

**Regression coverage:** A touch-browser case checks the one-tap transition,
correct layer fields, focus, unchanged history, and switching to another layer.
Existing mobile, editor-shell, advanced-route, and elevation workflows were
adapted to the new deliberate navigation contract and pass.

**Reproduce:** Starting on a phone canvas, duplicate or delete a layer
that is not currently selected.

**Actual:** The path is Layers > select layer (which closes Layers) > Properties >
Layer menu > action. The layer list itself offers visibility, lock, and reorder
but no contextual menu or direct Edit properties action.

**Impact:** Repeated layer management entails five actions and two distinct
drawers per operation, with context switching between a list and a separate
inspector.

**Expected / improvement:** Offer a row context menu or an explicit Edit action
that opens the selected layer's properties. Preserve selection-for-preview as
a separate behavior if that is the intended default.

**Code:** `src/app/components/LayersSidebar.tsx:51-54,69-86`;
`src/app/components/LayerIdentityProperties.tsx:63-71`.
**Artifact:** `ux-mobile-layer-selection.json`.

### UX-015 - Selecting the basemap hides the map-design controls

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. The selected basemap retains its metadata
controls and now offers an explicit Map design settings action. It navigates
to the existing project/map inspector and focuses its heading, rather than
requiring an unexplained empty-map click or duplicating style state in a
second editor.

**Regression coverage:** Unit cases verify focus, unchanged history, and the
available map controls. Desktop and mobile browser cases follow the action and
apply a real style change; the existing style-gallery and selection coverage
also passes.

**Reproduce:** Click Paper basemap in Layers, then look for the map style,
language, label size, or visible map categories.

**Actual:** The inspector switches to a generic layer view with Name, Opacity,
Visible, and Locked only. All map-design controls live in the unselected Project
view. No Back to Project or Edit basemap style link is offered in the layer view.

**Impact:** Selecting the object a user wants to style removes the relevant
styling controls. Discovering that clicking empty map space restores them
requires knowing an otherwise unexplained selection convention.

**Expected / improvement:** Show relevant map-style controls when the basemap is
selected, or offer an explicit link to its settings and to Project properties.

**Code:** `src/app/components/PropertiesSidebar.tsx:131-138`;
`src/app/components/LayerProperties.tsx:171-199`;
`src/app/components/ProjectProperties.tsx:249-255`.

### UX-016 - Autosave claims all changes are saved while route drafts are lost on reload

**Severity:** High. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. Per the user's choice, autosave and
downloads still contain completed project content only. Document-scoped route/
area owners report meaningful unfinished geometry and point input separately
from committed state. A transient presence flag drives truthful status, an
explicit warning disclosure, native unload confirmation, and a coordinated
choice before replacing a project containing unfinished work. It is not
serialized and does not cause extra document-save calls.

Empty tools and untouched extension anchors do not warn. Suspended area work
and changed/incomplete coordinate input remain protected. Finish, explicit
discard, and new document epochs clear the correct owner's state. Pending,
failed, and unavailable autosave states are not presented as successful saves.

**Review correction:** A read-only review found that Enter on the new warning
disclosure could finish a route. Route and area shortcuts now share a native-
activation target guard, including `summary`. A browser regression proves
Enter expands the disclosure without committing; Enter on the map still finishes.

**Verification and limitations:** `ux-fix-016-verification.json` records the
worker's commands and evidence. Parent follow-up passed 47 unit cases and 10
browser cases, including native reload cancellation, explicit replacement,
disclosure activation, and keyboard drawing. This is warning-based protection,
not recovery: accepting navigation loses the draft, and browser/mobile/OS
policy may bypass native warnings. The disclosure explains that limitation.
The broader completed-project replacement issue UX-025 remains pending.

**Reproduce:** Change page orientation and wait for "All changes saved locally".
Begin a route and add three points without pressing Finish. Reload the page.

**Actual:** While "3 points added - Finish when ready" is displayed, the footer
still says "All changes saved locally". Reload produces no leave-warning dialog.
The restored project has only its basemap and the route draft is gone.

**Impact:** A reassuring persistence claim includes work that is not actually
persisted. Users can lose a long unfinished route by reloading or leaving.
The tool-switch discard dialog does not protect navigation/reload.

**Expected / improvement:** Persist recoverable authoring drafts, or clearly
distinguish "Document saved; unfinished route not saved" and warn before leaving.

**Code:** `src/app/hooks/useRouteCoreState.ts:87-106`;
`src/app/hooks/useCanvasRouteAuthoring.ts:72-88`;
`src/app/components/LayersSidebar.tsx:192`.
**Artifacts:** `ux-route-draft-reload.json`, `ux-route-draft-autosave.png`.

### UX-017 - White primary-button text fails normal-text contrast

**Severity:** Medium. **Evidence:** Measured from browser-computed colors.

**Resolution:** Verified, 2026-09-04. The shared interaction accent now uses
the application's existing marker-blue hue, `#0D78B5`, providing 4.804:1 against
white. Primary buttons, active tool labels, and related token consumers inherit
the correction rather than receiving isolated color overrides.

**Regression coverage:** Browser cases calculate contrast from actual computed
foreground/background colors, including mobile Export's pseudo-element and
default/hover states. Active tool labels and export-dialog actions meet 4.5:1.
Design-token, type, and lint checks pass.

**Reproduce:** Inspect the enabled Export button in the desktop editor.

**Actual:** Its 13px, weight-500 text is white (`#FFFFFF`) on `#1AA2E6`, a
**2.86:1** contrast ratio. Normal-sized text requires 4.5:1 under WCAG 2.x AA.
The shared primary-button treatment is reused for other main actions.

**Impact:** Primary action labels are harder to read for users with low vision
or under low-contrast viewing conditions.

**Expected / improvement:** Darken the primary background or use a sufficiently
dark foreground while retaining recognizable enabled/hover/focus states.

**Code:** `src/theme.css:17,33,55`;
`src/styles.css:162-169`.
**Artifact:** `ux-text-contrast.json`.
Muted body/supporting text measured in the same pass passed 4.5:1; it is not
included in this finding.

### UX-018 - Advertised Shift+1 shortcut fails on a standard US keyboard

**Severity:** Low. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified, 2026-09-04. Shortcut resolution recognizes physical
`Digit1` while Shift is held, including the US keyboard's `key="!"`, and retains
the existing semantic `key="1"` path. It still respects text editing, modifiers,
map locking, and modal interaction ownership.

**Regression coverage:** Real browser key events increment the fit request
only in the allowed context; typing in search, a locked map, and an export
dialog do not trigger it. Unit coverage includes the key-only compatibility path.

**Reproduce:** Focus the canvas/tool area and physically press Shift plus the
Digit1 key on a US keyboard. Compare with clicking Fit page.

**Actual:** The key event is `key="!", code="Digit1", shiftKey=true`; the fit
request remains at `0`. Clicking Fit page increments it to `1`.
The handler requires `event.key === "1" && event.shiftKey`, while the tooltip
advertises Shift+1.

**Impact:** The documented navigation shortcut does not work for a common
keyboard layout.

**Expected / improvement:** Match the intended physical key or support the
appropriate shifted symbol, and exercise real key/code combinations.

**Code:** `src/app/components/CanvasWorkspace.tsx:58-65`;
`src/map/MapPageNavigationControl.ts:15-16`.
**Artifact:** `ux-fit-keyboard.json`.

### UX-019 - Enter does not apply edited page dimensions

**Severity:** Low. **Evidence:** Browser-reproduced; code-confirmed.

**Resolution:** Verified with UX-005, 2026-09-04. The shared numeric-field
contract commits on Enter and cancels the buffered edit on Escape. Value-based
component keys were removed, so committing a new dimension does not remount the
focused input. The following blur does not commit the same edit twice.

**Regression coverage:** Unit coverage confirms stable input identity and one
commit. The Chromium Page width case checks that Enter changes the actual print
frame to `240 / 210`, sets Custom, retains focus, and is reversed by one Undo.

**Reproduce:** On a 210 x 297mm page, enter `230` in Page width and press Enter.

**Actual:** The field reads 230 but the print frame stays `210 / 297`.
Only moving focus away commits it and changes the frame to `230 / 297`.
Coordinate fields and the project title, in contrast, explicitly commit on Enter.

**Impact:** Users cannot tell whether the geometry is awaiting confirmation,
lagging, or ignoring the input. Numeric editing conventions differ by field.

**Expected / improvement:** Commit valid values on Enter, preserve a clear
cancel behavior, and apply the same convention to similar inspector fields.

**Code:** `src/app/components/ProjectProperties.tsx:28-60`;
compare `src/app/components/CoordinateField.tsx:90-98`.
**Artifacts:** `ux-page-enter.json`, `ux-page-blur.json`.

### UX-020 - Search-created places can be invisible outside the current view

**Severity:** Medium. **Evidence:** Browser-reproduced with deterministic
intercepted search results; code-confirmed.

**Resolution:** Verified, 2026-09-04. After the user delegated the UX choice,
the implementation keeps print framing and presents an explicit Show on map
confirmation. The action is tied to the created place and document scope,
reflects map-lock/layer-visibility constraints, and cannot revive stale
confirmation after Undo/Redo. Reveal/dismiss return focus to Select rather than
opening the search keyboard over the revealed map.

**Regression coverage:** Desktop and mobile tests add a remote place, confirm
unchanged camera/frame until Show on map, then verify the marker is in view.
Unit cases cover lock/visibility updates, stale confirmation, and query-edit
focus. Existing durable/editable/exportable searched-POI coverage passes.

**Reproduce:** With Vienna visible, activate Place, search for New York, and
choose the New York result.

**Actual:** The new place appears in Layers, but the camera remains
`16.3725,48.2084` and the point is created at `-73.9857,40.7484`.
Its marker is hundreds of thousands of CSS pixels off-screen. No off-screen
notice, pan-to-result action, or immediate fit-to-selected action is offered.
The same search box navigates the map in Select mode, but changes semantics in
authoring modes.

**Impact:** Users can reasonably conclude that adding the place failed, repeat
the action, or export without realizing the new content is outside the frame.

**Expected / improvement:** Preview/navigate to the result before placing it,
or explicitly say it was added outside the current view and offer Show on map.
Do not silently reframe a carefully composed map without an appropriate choice.

**Code:** `src/app/hooks/useCanvasWorkspaceInteractions.ts:73-101`;
`src/app/hooks/usePoiAuthoring.ts:62-72`.
**Artifacts:** `ux-search-created-offscreen.json`,
`ux-search-created-offscreen.png`.

### UX-021 - Search results stay open after clicking the map

**Severity:** Low. **Evidence:** Browser-reproduced with intercepted results.

**Resolution:** Verified, 2026-09-04. Outside pointer interactions and keyboard
departure close search results and cancel pending debounce/requests while
preserving the query. Late responses cannot reopen dismissed results. Active
option state resets with query/results changes, and options use the combobox's
arrow/active-descendant model instead of adding extra Tab stops.

**Reproduce:** Search for a location, wait for results, then click empty map
space to return to editing.

**Actual:** Focus moves to the canvas, but the result list remains open over it.
The component has no blur/outside-dismissal behavior; results disappear only
after selecting one, changing the query, or pressing Escape while in the input.

**Impact:** Old results continue obscuring map content even after the user has
visibly moved to another task.

**Expected / improvement:** Dismiss results when leaving the search interaction,
while preserving the query and the ability to reopen its suggestions.

**Code:** `src/app/components/LocationSearch.tsx:133-160`.
**Artifact:** `ux-search-outside-click.json`.

### UX-022 - Search gives no visible or announced loading feedback

**Severity:** Low. **Evidence:** Browser-reproduced with a 1.6-second
intercepted response delay.

**Resolution:** Verified, 2026-09-04. A shared search state machine drives
visible pending text, input busy state, and a stable live region outside the
busy control. Result counts are announced. Submission preserves search focus,
and dismissed/aborted work returns to idle without late popups or false success.

**Regression coverage:** A controlled pending response is held while browser
assertions inspect visible/loading announcements and input focus. The combined
search change passed 40 targeted unit cases and six browser cases, plus a
four-case confirmation-state rerun, typecheck, and targeted lint.

**Reproduce:** Type a query when the place-search response is delayed.

**Actual:** The submit button becomes disabled, but no spinner, "Searching"
message, live status, or input busy state is exposed. The search surface contains
no status text during the pending request.

**Impact:** Users cannot distinguish a pending search from an ignored input or
a lack of results, especially when relying on announcements.

**Expected / improvement:** Provide concise visual and accessible pending
feedback, followed by a result count or the existing error/no-results feedback.

**Code:** `src/app/components/LocationSearch.tsx:87-88,154-159`.
**Artifact:** `ux-search-busy-feedback.json`.

### UX-023 - A valid long project title pushes header actions off-screen

**Severity:** High. **Evidence:** Browser-measured and visually reproduced.

**Resolution:** Verified, 2026-09-04. Header grid tracks now have shrinkable
minimums, the title can shrink/ellipsize, and branding remains fixed. The input
also respects its available width. Accepted names are not truncated in the
document and actions are not moved with positional workarounds.

**Regression coverage:** 120-character names are tested while editing and after
commit at 1440, 1024, 900, and 600px. Actual action bounds stay inside the viewport,
the title visibly ellipsizes, and Project remains operable. Existing header and
design-token coverage passes.

**Reproduce:** Rename the project to 120 `W` characters (the accepted maximum),
then use a 1024 x 768 desktop viewport.

**Actual:** The title button becomes 1446px wide. Undo/Redo start at x=1559 and
Export at x=1733, all outside the 1024px viewport. The document does not expose
horizontal scrolling, so the actions are unreachable by pointer.

**Impact:** A valid metadata edit makes essential project/export/history
controls disappear. There is no warning or accessible layout recovery affordance.

**Expected / improvement:** Give the desktop grid and brand/title container
shrinkable minimum widths and constrain/ellipsize the title without displacing
fixed document actions.

**Code:** `src/app/components/ProjectTitleEditor.tsx:29-34,45-48`;
`src/styles.css:56-64,118-119`.
**Artifacts:** `ux-long-project-title.json`, `ux-long-title-1024.png`.

### UX-024 - One failed map tile leaves the editor permanently in an error state

**Severity:** High. **Evidence:** Browser fault injection; code-confirmed.

**Resolution:** Verified, 2026-09-04. Classified transient tile failures receive
bounded retries; other failures expose in-place Retry. Native renderer lifetimes
own cleanup/rebinding, and readiness/export are withheld until resources and
content are actually ready. Authoring owners remain mounted, preserving drafts,
input, settings, selection, editing handles, and custom images.

**Review corrections:** New renderers apply camera locks before content becomes
ready. Captured cameras survive failed creation attempts and newer canonical
changes supersede stale captures. Interrupted genuine motion is published once
through the normal camera/history/amend path, keeping native view, inspector,
scale, and saved camera coherent; no-op retries preserve history and redo.

**Regression coverage:** The worker's final record includes 222 unit tests and
28 distinct Chromium workflows, including transient/persistent tile failure,
actual WebGL context loss, delayed styles, failed creation, interrupted motion,
one-shot commands, selected editors, and export readiness. Exact files,
commands, measurements, and limitations are in `ux-fix-024-results.json`.

**Export-restoration follow-up:** Verified. PDF/PSD exposed a race after basemap
capture: visibility restoration produced a render before source loading and
published exporter readiness were restored. A shared event-driven readiness
barrier now waits for both conditions during isolation and restoration, keeps
cancellation/restoration bounded, and prevents retired exporters from changing
a successor map. It does not force readiness or weaken stale-source guards.
All 45 focused unit cases and 17 Chromium export/recovery workflows passed,
including actual SVG-to-PDF/PSD downloads, delayed restoration, cancellation,
and actual WebGL loss. Typecheck and targeted lint passed. A broader unit run
passed 127/128, with an unrelated ambiguous status query in
`large-raster-export.test.tsx:93` left unchanged. Details and artifacts:
`ux-fix-024-export-results.json` and `ux-fix-024-export-final/`.

**Reproduce:** Allow normal editor resources to load but fail exactly one
OpenFreeMap tile request. Remove the failure interception, then zoom the map
with subsequent network requests allowed.

**Actual:** The editor reports "Map preview unavailable. The map renderer
encountered an error. Reload the page and retry." The error and lack of
`data-map-ready` persist after connectivity is restored. There is no Retry
button. The lifecycle also withdraws the map exporter.

**Cause:** Every map error is treated as a fatal renderer failure; subsequent
idle events immediately return while `mapFailed` is true.

**Impact:** A single transient tile/network failure turns a recoverable partial
rendering issue into a session-wide blocked preview/export state. The prescribed
reload can also destroy an unfinished route (UX-016).

**Expected / improvement:** Distinguish recoverable tile/resource errors from
renderer/context loss, retry resources or provide an in-place recovery action,
and preserve the current document and authoring draft during recovery.

**Code:** `src/map/MapCanvasLifecycle.ts:162-174,201-220`;
`src/map/MapCanvas.tsx:162-166`.
**Artifacts:** `ux-transient-tile-failure.json`, `ux-transient-tile-failure.png`.
This is a controlled recovery test, not a claim that the provider was down.

### UX-025 - Opening another project overwrites the only local copy without confirmation

**Resolution:** Verified. Project opening now protects completed layers,
basemap-only designs, restored projects with no Undo history, and existing
Undo/Redo work. Only a genuinely pristine default document opens immediately.
The coordinated dialog names both projects, starts with Keep editing focused,
and offers a separate Download current project action. Downloading reads the
live document, validates the portable backup, and leaves the dialog and project
intact. A failed download is explained without discarding anything. Replacement
requires a subsequent explicit decision and remains a fresh history root.
Unfinished-drawing warnings retain the completed-only persistence contract.
Obsolete file reads cannot supersede a newer choice.

**Verification:** 41 targeted unit cases and 27 Chromium file, navigation,
replacement, and unfinished-drawing cases passed. New browser cases exercise
real downloads and IndexedDB, cancellation/selection/history, confirmed
replacement across reload, restored basemap-only work, pristine first open,
latest-file-read ownership, and 320px keyboard focus. Download-failure and
file-delay cases use explicit browser fault injection. Typecheck and targeted
lint passed. Evidence is retained in `ux-fix-025/` in the audit artifact directory.
The invalid canonical-edit admission defect remains separately tracked as
UX-026; rejecting an unreadable download is only a final backstop.

**Severity:** High. **Evidence:** Browser-reproduced; code-confirmed.

**Reproduce:** Create a place, change page orientation, and wait for "All changes
saved locally". Without downloading that project, open a different valid project.
Reload the editor.

**Actual:** The replacement occurs immediately, removes the original layers,
disables Undo, and overwrites the one browser-local draft. Reload restores only
the replacement. No confirmation or backup option protects the original.

**Impact:** "Saved locally" work can be irreversibly lost through an ordinary
Open operation. Invalid-file rejection is safe; valid replacement is the risk.

**Expected / improvement:** Offer Download current project and open / Replace /
Cancel, or retain a recoverable previous-project snapshot.

**Code:** `src/app/components/ProjectFileActions.tsx:47-54`;
`src/app/storeDocument.ts:72-85`;
`src/storage/AutosavePersistenceSession.ts:27-36`.
**Artifacts:** `ux-files-01-current-work-saved-locally.png`,
`ux-files-01-replacement-no-undo.png`,
`ux-files-01-replacement-persists-after-reload.png`.

### UX-026 - Accepted edits produce projects that cannot autosave or reopen

**Resolution:** Verified. A shared store admission boundary uses the project
parser's structural constraints before publishing a candidate document, history,
or selection. Immutable-reference caches avoid rechecking geometry on camera-only
updates. Accounting includes sampled Arc positions, closing points, provider
waypoints, and basemap capacity. Rejected operations preserve canonical state
and return actionable results to the initiating UI. Spreadsheet text, invalid
name input, and unfinished route/area drafts remain available for correction.
Derived duplicate names/IDs stay bounded and unique without truncating manually
entered names. Rejected native previews explicitly restore their correct source
and handles rather than relying on a store update that never occurs.

**Verification:** 397 worker unit cases plus two parent regressions; 22 worker
Chromium workflows plus two parent pointer/keyboard cases. The original fourth
300-row batch is rejected at 901 layers with a 99-slot explanation; correcting
the batch reaches exactly 1,000 and survives download/reopen/reload. A
201-character name stays editable while its saved name remains unchanged.
Capacity-rejected drawings retain their input; exact 200,000-position Arc
accounting rejects and rolls back a native midpoint insertion. Independent
review found a Road rollback using waypoints instead of the routed path; the
parent corrected that separation and directly verified stale-after-Undo
pointer/keyboard edits preserve source geometry, document, and history.
Typecheck and targeted lint passed. Evidence: `ux-fix-026-results.json`,
`ux-fix-026-file-manifest.json`, and `ux-fix-026-road-rollback/`.
Portable pretty-JSON byte inflation remains UX-029, not a claimed fix here.

**Severity:** High. **Evidence:** Two independently browser-reproduced admission
failures; downloaded files and reload behavior examined.

**Reproduce A:** Starting with one basemap, add four 300-row coordinate lists.
Download the resulting project, then try to open it.

**Actual A:** All batches are accepted, producing 1,201 layers. Autosave pauses
after the fourth batch; the last saved version contains 901 layers. Download
appears successful, but Open rejects the file with "Projects may contain at most
1000 layers." Reload loses all 300 places from the fourth batch.

**Reproduce B:** Enter a 201-character Layer name and blur, then download/reopen.

**Actual B:** The name commits and autosave pauses. Download succeeds, but Open
rejects "Layer 1 name must be 200 characters or fewer." Reload restores the
previous name.

**Impact:** Successful-looking edits violate the project's persistence
constraints. Even the offered portable backup cannot be reopened.

**Expected / improvement:** Share admission constraints across UI, store,
autosave, download, and parser. Reject invalid changes before replacing canonical
state, explain remaining capacity/length inline, and validate downloads.
These cases share one saveability-contract failure rather than being separate
generic autosave-error findings.

**Code:** `src/app/storePoiActions.ts:102-147`;
`src/app/components/LayerIdentityProperties.tsx:68`;
`src/app/storeLayerActions.ts:207-216`;
`src/domain/projectFile.ts:54-59,215-219`;
`src/app/components/projectDownload.ts:9-18`.
**Artifacts:** `ux-files-02-own-download-rejected.png`,
`ux-files-02-reload-only-900-pois.png`,
`ux-files-13-own-download-rejected.png`.

### UX-027 - Damaged-draft recovery offers only deletion and can trap the editor

**Resolution:** Verified. The failed load now retains a detached recovery record
for a distinctly named recovery-data download, not a supposedly reopenable
project. Downloads neither dismiss the decision nor discard data; values that
cannot be faithfully represented as JSON produce an explicit error instead of
a misleading partial backup. Continue without autosave leaves the stored record
untouched and disables persistence, including lifecycle writes. An expandable
notice below search explains the offline state without obstructing controls.
Offline edits receive best-effort native exit protection.

Discard remains explicit and retryable, with an atomic decision guard and
existing cross-tab identity protection. Its failure messages point to available
recovery actions rather than an inaccessible Save control. Non-destructive
initial focus, keyboard-scrollable details, and a separately retained action
row keep the workflow usable when errors make the dialog taller.

**Verification:** 68 targeted unit cases and 21 Chromium workflows passed.
Actual IndexedDB, recovery/current-project downloads, reload warnings, failed
discard/retry, failed download, later-record protection, and no writes during
offline edits/pagehide were exercised. At 320 x 568 and 844 x 390, keyboard
scrolling exposes long failure details while all 44px actions remain reachable;
search remains clickable after continuation. Typecheck and targeted lint
passed. Final screenshots were visually reviewed. Evidence:
`ux-fix-027-results.json` and `ux-fix-027-verified/`.
Storage/download failures are controlled browser faults; responsive tests are
Chromium emulation, not physical-device or screen-reader testing.

**Severity:** High. **Evidence:** Browser with an explicitly seeded unsupported
draft and injected storage-discard failure; code-confirmed.

**Reproduce:** Load an unsupported local draft. Try to preserve it or leave the
recovery dialog. Then make Discard damaged draft fail with a storage quota error.

**Actual:** The only action deletes the draft; Escape does not dismiss the
dialog. There is no raw recovery download or Continue without autosave action.
If discard fails, the modal stays blocked while its error recommends "Use Save",
which is inaccessible behind the modal and not the current menu label.

**Impact:** Users must destroy potentially recoverable data to proceed, and a
storage failure can leave no usable recovery path.

**Expected / improvement:** Offer a recovery-data download, safe continuation
without overwriting the damaged record, and actionable retry/storage guidance.

**Code:** `src/storage/AutosaveCorruptionDialog.tsx:14-35`;
`src/storage/useProjectAutosave.ts:60-79`.
**Artifacts:** `ux-files-03-unsupported-draft-only-discard.png`,
`ux-files-03-discard-failed-save-unreachable.png`.

### UX-028 - Cross-tab conflict guidance leads users to discard their unsaved version

**Resolution:** Verified. A conflict permanently retires that persistence session,
including queued and lifecycle saves, without removing the tab's work. The
below-search notice opens a coordinated decision with Download this tab's
version, Keep editing, and explicit Discard this tab and load saved version.
Downloading does not replace the tab or imply that a file reached disk; failed
backups retain the decision and current work. Native exit protection includes
conflicted completed work, with the usual browser limitations.

Saved-version loading is an owned, cancellable transaction. Late, failed,
missing, damaged, or locally obsolete reads cannot replace work or enable
persistence. Only deliberate successful replacement starts a fresh writer;
the loaded snapshot itself is not written back. Existing record identity and
revision checks still reject a newer winner that appears after the read.

**Verification:** 77 worker unit cases and 20 Chromium workflows passed,
including actual A3/A5 conflicts in two pages sharing IndexedDB, current-tab
downloads, selection/history retention on cancel, explicit replacement,
deferred-read cancellation, a newer winner, unfinished inputs, and keyboard
scrolling at 320 x 568 and 844 x 390. The six UX-025 and six UX-027 cases passed
again. Parent reran 13 focused cases, reviewed the source and screenshots, and
confirmed all 17 delivered file hashes. Typecheck and targeted lint passed.
Evidence: `ux-fix-028-results.json` and `ux-fix-028-browser-final/`.
Deferred callback and download failures are explicit test faults; no physical
device or screen-reader claims are made.

**Severity:** High. **Evidence:** Browser-reproduced with two isolated tabs.

**Reproduce:** Open one saved draft in two tabs. In tab A, change the page to A3;
in tab B, change it to A5. Follow tab B's instruction to reload and review the
newer draft.

**Actual:** The stale save is correctly rejected, but the message does not warn
that reload discards this tab's unsaved changes or advise downloading them.
Following it replaces B's A5 version with A's A3.

**Impact:** A conflict-protection mechanism gives recovery instructions that
lose one version of the user's work.

**Expected / improvement:** Provide Download this tab's version before an
explicitly destructive Reload other version action. Preserve stale-write
protection itself.

**Code:** `src/storage/autosave.ts:182-184,249-252`;
`src/storage/ProjectAutosaveUi.tsx:46-49`.
**Artifacts:** `ux-files-04-conflict-says-reload.png`,
`ux-files-04-reload-lost-a5.png`.

### UX-029 - A valid imported boundary can become impossible to download as a project

**Resolution:** Verified. Small projects retain readable JSON; large readable
output falls back to compact JSON without removing content or adding a
limit-breaking trailing newline. An exact UTF-8 compact-size budget now applies
before canonical publication and history, including parser-normalized content.
Immutable-fragment caches avoid serializing geometry/assets for camera-only
updates. Genuine over-limit edits produce owner-local feedback; numeric/name
drafts remain correctable, and native camera/POI previews roll back to canonical
state without extra history or lost Redo.

**Verification:** 330 targeted unit cases passed. Fifty distinct Chromium cases
were validated: 49 passed in the combined run, and an existing native-camera
interruption timing fixture was corrected and passed twice afterward. This
included all relevant map recovery/export, admission, replacement, damaged-draft,
and cross-tab workflows. Independent review found no significant issues.
The original 160,200-position import downloads as 3,531,409 bytes instead of
12,540,714 readable bytes. Parent independently measured the exact-cap artifact:
10,485,760 bytes, no newline, 207 unique layers, 160,206 positions, and six valid
assets retained. Scalar, camera, and mobile rejection screenshots were reviewed.
All 51 delivered file hashes matched; types and targeted lint passed.
Evidence: `ux-fix-029-results.json`, `ux-fix-029-file-manifest.json`, and
`ux-fix-029-browser-final/`.

**Severity:** Medium. **Evidence:** Browser-reproduced; input and serialized
output sizes measured.

**Reproduce:** Import a valid 200-polygon GeoJSON with 160,200 positions, within
the accepted input limits, then choose Download project.

**Actual:** The 3,488,743-byte input imports and autosaves successfully, but
pretty-printed portable JSON expands to 12,532,708 bytes, above the 10 MiB download
limit. The remedy offered is to remove project content.

**Impact:** Accepted work cannot be portably backed up without deleting or
splitting it. Browser autosave still works in this case.

**Expected / improvement:** Align import and portable-serialization budgets,
prefer compact JSON where sufficient, and warn before accepting genuinely
nonportable content.

**Code:** `src/import/mapDataBatch.ts:117-125`;
`src/app/components/projectDownload.ts:9-17`.
**Artifact:** `ux-files-05-valid-import-cannot-download.png`.

### UX-030 - Single-file import behavior changes depending on chooser versus drag

**Resolution:** Verified. All chooser and drag batches now enter the same explicit
review, including single files. Fit imported content is the common default;
Keep current view remains an explicit choice. Reading, parsing errors, stale
source changes, and blocked drops provide feedback. Cancel, Close, Escape, or
backdrop dismissal retire the exact transaction without importing or letting old
IO change the next operation. Review visibility is document-epoch-scoped, so
replacement cannot briefly revive an old review. Layer replacement retains its
identity/appearance contract.

**Verification:** 143 shared unit cases and 58 distinct Chromium cases were
validated. The combined run passed 56/58; a 16-case follow-up passed all cases,
with slow-fixture and native keyboard timing caveats retained in the report.
Identical Tokyo files exercise both input methods with Fit and Keep choices;
cancel/new-read, same-file retry, epoch retirement, stale content, keyboard,
replacement, admission, and portable-budget regressions passed. Parent reviewed
the source/screenshots, reran 25 focused cases, and checked the 20-file manifest.
Evidence: `ux-fix-030-results.json` and `ux-fix-030-browser-verified/`.

**Severity:** Medium. **Evidence:** Browser-reproduced, including a controlled
slow-read race.

**Reproduce:** With Vienna visible, import one Tokyo GeoJSON through the chooser.
In a fresh context, drag the identical file onto the editor.

**Actual:** The chooser commits immediately without review and leaves the map
in Vienna. Dragging opens review with Fit imported content checked and moves to
Tokyo after import. With a delayed chooser read, changing a page setting causes
safe stale-import rejection but no reading, completion, or error feedback.

**Impact:** The same file has different review and positioning behavior depending
on input method. Imported content can appear missing, and rejected operations
can appear to do nothing.

**Expected / improvement:** Use one review/fit/feedback contract regardless of
input method and explicitly explain rejected stale reads.

**Code:** `src/app/hooks/useMapDataImportReader.ts:140-155,214-221`;
`src/app/components/GeoJsonImportButton.tsx:99-101`.
**Artifacts:** `ux-files-06-chooser-tokyo-offscreen.png`,
`ux-files-06-drop-tokyo-fitted.png`,
`ux-files-06-stale-import-silently-rejected.png`.

### UX-031 - Blank import width is flagged invalid but creates zero-width routes

**Resolution:** Verified with UX-030. The same string-aware validation result
drives field descriptions/invalid state, submit eligibility, and actual styling
application. Blank and whitespace values cannot become zero, including direct
commit calls. Deliberately entered zero remains valid for route width. POI size
and shape outline width share their existing range constraints. Rejected text
stays correctable, with an associated, at-least-12px explanation.

**Verification:** Shared import tests cover blank/whitespace/range rejection,
disabled submission, direct-call rejection, corrected values, and an explicit
zero-width route surviving portable serialization. Parent ran all three
dedicated browser cases and repeated the phone case with a legibility assertion.
Types and targeted lint passed. Evidence: `ux-fix-031-results.json` and
`ux-fix-031-legibility-final/`.

**Severity:** Medium. **Evidence:** Browser-reproduced; resulting document
inspected.

**Reproduce:** Open a route import review, clear Import route width, and submit.

**Actual:** The field has `aria-invalid="true"` but Import remains enabled.
The saved route has `appearance.width: 0` because a second validator coerces an
empty string to zero.

**Impact:** Visibly invalid input is accepted and can make the imported route
invisible, appearing to lose imported content.

**Expected / improvement:** Use the same string-aware validator for field state,
submit enablement, and commit. Reject blank input with a clear explanation.
Explicit zero may remain valid if intentionally supported.

**Code:** `src/app/components/MapDataImportPortals.tsx:40-43,66`;
`src/import/mapDataBatchAppearance.ts:49-50,82-88`.
**Artifacts:** `ux-files-07-blank-invalid-but-import-enabled.png`,
`ux-files-07-imported-route-width-zero.png`.

### UX-032 - PDF allows a predictably failing download, then shows raw memory numbers

**Resolution:** Verified. The selected PDF format now uses the same PDF preflight
as the execution guard, rather than the PNG plan or an unconditional enabled
button. Unsafe output is explained before download, in readable MiB, with page
size guidance and an explicit SVG raster-detail tradeoff. The disabled action
references that explanation. Format switching does not carry an obsolete PDF
error into a supported alternative.

Long preflight information exposed a short-screen export layout problem; the
header/actions now stay in place while a labeled, keyboard-focusable content
region scrolls. This retains focus containment and access to cancellation.

**Verification:** 59 unit cases and eight Chromium workflows passed, covering the
original 1330 x 1330mm failure before any capture/renderer work, direct runner
guard, format alternatives, native PDF/PSD restoration/cancellation, and
1440/390/844px layouts. Correcting the page to 25.4 x 25.4mm produced a real PDF
with a 72 x 72pt MediaBox. The short-screen End-key check reaches the end of the
scroll region with guidance and actions visible. Types/lint passed; final
screenshots were reviewed. Evidence: `ux-fix-032-results.json`,
`ux-fix-032-verified/`, and `ux-fix-032-short-screen/`.

**Severity:** Medium. **Evidence:** Browser-reproduced; code-confirmed.

**Reproduce:** Set a 1330 x 1330mm page, open Export, select PDF, and download.

**Actual:** Download PDF is enabled without a preflight warning. Clicking it
fails with "Estimated peak memory is 882993928 bytes; the budget is 536870912
bytes." No useful page-size or output adjustment is suggested.

**Impact:** Users are invited into a known failure and must interpret technical
memory figures to find a workable output configuration.

**Expected / improvement:** Run the selected format's preflight before enabling
download and translate the limitation into practical output alternatives.

**Code:** `src/app/components/ExportDialogView.tsx:39-53,251-260`;
`src/app/components/exportDialogPdf.ts:58-61`.
**Artifacts:** `ux-files-08-pdf-enabled-before-preflight.png`,
`ux-files-08-pdf-raw-memory-failure.png`.

### UX-033 - Address spreadsheets commit the first geocoding match without review

**Resolution:** Verified. Address lookup now produces suggestions rather than
layers. Review shows the provider's actual locality and coordinates separately
from the desired POI name. Ambiguous rows require a choice; queries can be
corrected/retried and rows excluded before explicit atomic addition. Failed
lookups or capacity rejection retain correctable data. Five-row review pages
and a bounded short-screen surface preserve the same draft owner.

**Verification:** 141 unit cases passed after parent corrections. The worker
validated 58 browser cases; two additional parent cases cover guarded route
extensions, and the full 13-case address/extension subset passed. Controlled
suggestions demonstrated that the initial Illinois match was not silently
chosen: the saved batch contains the selected Massachusetts point and corrected
Vienna point, with desired names, while an excluded row is absent. One Undo
restores the original project. Parent checked downloaded output and screenshots.
Independent review findings were corrected and the final review was clear.
Evidence: `ux-fix-033-results.json` and `ux-fix-033-035-parent-review/`.
These cases establish review behavior, not live-provider accuracy.

**Severity:** Medium. **Evidence:** Code-confirmed; live ambiguity remains
untested because this environment has no real provider token.

**Reproduce:** Submit a list containing an address/name that can resolve to
multiple cities or localities.

**Actual:** Each lookup requests one result and immediately uses its coordinates.
The returned matched location label is not presented for verification; the
original user-supplied name remains on the place.

**Impact:** Plausible but incorrect matches can enter a print map without a
review opportunity or a visible indication of which locality was chosen.

**Expected / improvement:** Separate lookup from commit, show the matched
address/locality, and allow correction or exclusion before adding the batch.

**Code:** `src/app/components/PoiSpreadsheetPanel.tsx:27-44,86-93`.
This finding concerns the confirmed absence of a review step, not a claim that
the provider returned an incorrect result during this audit.

### UX-034 - An old import-success notice completely covers later file errors

**Resolution:** Verified. File workflows now render into one bounded notification
stack with separate error and success outlets, placing errors first in both DOM
and visual order. This changes presentation ownership rather than adding
competing z-indexes or guessed vertical offsets. Each workflow retains its
current status and existing asynchronous transaction guards.

Messages have independent 44px dismissal controls with safe focus restoration
to the Project/import trigger. Dismissing or successfully retrying one workflow
does not misrepresent another workflow's result.

**Verification:** 25 unit cases and 17 Chromium file/import workflows passed.
The original import-success/malformed-project sequence and a controlled download
failure show the error above, not underneath, the earlier success. Priority,
non-overlap, bounds, dismissal, focus, and return to unobstructed search were
checked at 1440, 390, and 320px. Types/lint passed and final screenshots were
reviewed. Evidence: `ux-fix-034-results.json` and `ux-fix-034-verified/`.

**Severity:** Medium. **Evidence:** Browser-reproduced and measured.

**Reproduce:** Import a valid GeoJSON, then open malformed project JSON.

**Actual:** "This file is not valid JSON." is rendered underneath the older
import-success notice. Both occupy the same 384 x 34px rectangle at (1048,48),
with `z-index: 90`; the success notice paints on top. The overlap also obscures
the large-project download error.

**Impact:** Sighted users see success when the current operation has failed,
with the actual reason and recovery guidance hidden.

**Expected / improvement:** Use a shared prioritized notification stack or
supersede old success messages when a new error occurs.

**Code:** `src/styles.css:67-75`;
`src/app/components/ProjectFileActions.tsx:123-126`;
`src/app/components/GeoJsonImportButton.tsx:120-127`.
**Artifact:** `ux-files-12-import-success-hides-open-error.png`.

### UX-035 - Switching spreadsheet modes erases the pasted draft

**Resolution:** Verified with UX-033. Coordinate and address buffers, corrected
review rows, and selections have one in-memory, document-scoped owner. Mode
switching/back navigation does not erase them or replay lookups. Successful
addition clears only the submitted mode. Exit decisions protect both lists;
new documents and retired requests cannot revive old data.

**Review corrections:** Route extension was a separate activation path that
bypassed the new list guard. It now carries a typed deferred command through the
same decision, preserving the exact route/endpoint. Keep editing retains both
buffers and matches; changed targets reject without discarding. Stable request
IDs prevent replay, without timeout coordination. Address announcements are
now mode-scoped, while genuine cross-mode success messages remain visible.

**Verification:** Shared coverage plus six new parent unit cases and real Extend
start/end workflows confirm retained data on cancel, deliberate discard, exact
existing-route continuation, and one-step Undo. Finished/stopped lookup notices
no longer appear in Coordinates mode. Types/lint and final independent review
passed. Evidence: `ux-fix-035-results.json`,
`ux-fix-033-035-parent-review/`, and `ux-fix-033-035-extension-final/`.
No unadded lists are serialized or recovered after accepted reload.

**Severity:** Low. **Evidence:** Browser-reproduced; code-confirmed.

**Reproduce:** Paste and edit coordinate rows, select Addresses, then return to
Coordinates.

**Actual:** Both mode changes clear the text. The 85-character reproduction
draft disappeared with no warning or recovery action.

**Impact:** Exploring an alternative entry method destroys prepared input;
any edits made after the original paste must be recreated.

**Expected / improvement:** Retain separate mode drafts or require an explicit
clear action.

**Code:** `src/app/components/PoiSpreadsheetPanel.tsx:114-117`.
**Artifacts:** `ux-files-11-prepared-spreadsheet.png`,
`ux-files-11-mode-switch-erased-rows.png`.

### UX-036 - There is no explicit way to start a fresh project

**Resolution:** Verified. Project > New project creates the canonical blank
document, not a manually stripped copy of the current map. It uses the existing
outgoing-work guard with New-specific copy, a separate completed-project backup,
Keep editing, and explicit confirmation. Pristine defaults do not prompt.
Confirmed creation resets document settings, layers, selection, history, and
draft epochs while preserving ordinary automatic restoration.

Older file reads are retired before parsing/dispatching their result, so they
cannot replace the newly created document. Canceled and superseded replacement
confirmations are invalidated by request identity as well as document epoch.

**Verification:** 21 unit cases and 19 Chromium workflows passed. A styled,
locked, non-default outgoing map is backed up unchanged, cancellation preserves
selection/history, and confirmed New produces exactly the default document.
Subsequent changes to that new map survive reload. Unadded lists, pending old
file reads, pristine creation, and the 320px Project menu are covered. Types,
lint, and final visual checks passed. Evidence: `ux-fix-036-results.json` and
`ux-fix-036-browser/`.

**Severity:** Medium. **Evidence:** Browser workflow and entry-point tracing.

**Reproduce:** Finish and download a map, then try to start an unrelated map.
Open Project or launch the editor in another tab.

**Actual:** Project offers only Open project, Download project, and Import map
data. Another tab resumes the same saved document. A fresh document is only a
startup fallback when no draft exists.

**Impact:** Beginning a second map requires manually dismantling the first,
finding an external blank project, or manipulating browser storage.

**Expected / improvement:** Add New project with an outgoing-work protection
choice. Preserve automatic restoration for ordinary startup.

**Code:** `src/app/components/ProjectFileActions.tsx:113-120`;
`src/mountApp.tsx:12-24`.
**Artifacts:** `ux-files-14-project-menu-no-new-command.png`,
`ux-files-14-new-editor-tab-resumes-existing-map.png`.

### UX-037 - A failed Road edit contaminates later Arc coordinates after conversion

**Resolution:** Verified. Pending committed-Road edits and errors now carry their
canonical owner and document epoch. Conversion, semantic geometry/provenance
changes, deletion, replacement, and restored history snapshots retire obsolete
values before consumers render and abort obsolete IO. Late results cannot revive
that state. Compatible direct styling/name changes and selection navigation
preserve the pending correction; successful completion rebases to current
metadata before the guarded store operation.

**Verification:** 110 unit cases and 15 Chromium workflows passed. The original
longitude 16.345 failed correction no longer leaks into Arc: editing only latitude
produces `[16.35, 48.205]` in inspector, native source, and downloaded geometry.
Held requests, replacement with reused IDs, deletion/Undo, compatible retry,
locks, capacity rejection, native routed-path preservation, and guarded POI
extensions were covered. Parent reran 26 focused cases, reviewed both source
files and output evidence, and checked all six file hashes. Types/lint passed.
Evidence: `ux-fix-037-results.json` and `ux-fix-037-browser/`.

**Severity:** High. **Evidence:** Browser with a deterministic committed-Road
fixture and real missing-token failure; code-confirmed. No live routing claim.

**Reproduce:** Change Road waypoint longitude from 16.35 to 16.345 and let
rerouting fail. Without canceling, convert to Arc. Change only anchor latitude
to 48.205.

**Actual:** Converted geometry initially retains longitude 16.35, but the Arc
inspector shows pending Road longitude 16.345. Its error and Cancel edit disappear.
The latitude edit then commits `[16.345,48.205]`, unintentionally reviving the
failed longitude, while the inspector still displays the old latitude 48.2.

**Impact:** A coordinate form displays stale state and applies an extra,
unrequested coordinate change without an obvious cancellation path.

**Expected / improvement:** Resolve/cancel incompatible pending edits when
changing route type and derive Arc fields only from the committed Arc state.

**Code:** `src/app/components/StudioAppView.tsx:81-96`;
`src/app/components/RouteLayerProperties.tsx:216-217`;
`src/app/components/RouteAdvancedProperties.tsx:76-88,220-226`;
`src/app/hooks/useDirectionsRouteEditing.ts:40-51,189-199`.
**Artifacts:** `ux-advanced-road-pending-converted-arc.png`,
`ux-advanced-results.json`.

### UX-038 - Moving a closed-route anchor destroys adjacent styling and bends

**Resolution:** Verified. Coordinate movement now preserves ordered logical leg
appearance and Arc curvature, including the first/final closure alias. Actual
topology changes continue through the appropriate existing transformations.
Native previews use the complete derived layer and their own content revision;
final synchronization follows canonical admission rather than assuming preview
completion means the editing engine is current.

**Review correction:** Actual `pointercancel` initially left a provisional
midpoint in the native engine. Cancellation now retires/rebuilds that editor
from the latest canonical data, without recreating MapLibre or writing to the
store. Releasing the canceled pointer or beginning another drag cannot commit
the abandoned insertion.

**Verification:** 318 unit cases and 36 Chromium cases passed. The original red
override and curvature 0.7 remain while only Anchor 2 longitude changes.
Pointer/keyboard/closure aliases, topology changes, native/SVG parity, exact
Undo/Redo, locks, byte rejection, and cancellation followed by another native
drag are covered. Parent independently compared complete before/after documents,
including locked/unlocked cancellation and next-drag cases. All 15 delivered
file hashes matched; final independent review was clear. Evidence:
`ux-fix-038-results.json`, `ux-fix-038-manifest.json`, and `ux-fix-038-browser/`.
Touch-shaped cancellation was exercised with the installed engine in jsdom,
not claimed as physical-device testing.

**Severity:** Medium. **Evidence:** Browser and before/after committed documents.

**Reproduce:** Close a three-point route, convert to Arc, give Leg 1 a red
override, and set Segment 1 curvature to 0.7. Move Anchor 2 slightly.

**Actual:** The coordinate changes, but the red override becomes null and
curvature resets to the default 0.35. Coordinate-pair remapping treats the
changed adjacent logical legs as new legs.

**Impact:** A geometry-only adjustment silently destroys styling work and alters
the curve beyond the intended move. Undo also reverses the desired coordinate edit.

**Expected / improvement:** Preserve logical leg appearance/bends for
coordinate-only moves, consistently with open-route direct editing.

**Code:** `src/domain/routeGeometry.ts:160-186`;
`src/domain/routePointRemovalTransformations.ts:183-220`;
`src/domain/routeTransformations.ts:106`;
`src/app/storeRouteGeometryActions.ts:180-183`.
**Artifacts:** `ux-advanced-closed-move-style-loss.png`,
`ux-advanced-results.json`.

### UX-039 - Collapsing Advanced discards elevation data and profile customization

**Severity:** Medium. **Evidence:** Browser with deterministic elevation
responses; actual component/disclosure lifecycle.

**Reproduce:** Generate a profile, choose Imperial units, 220mm print width,
Serif, and font size 60. Collapse and reopen Advanced on the same route.

**Actual:** The chart and download controls disappear. Regeneration makes
another terrain request and resets settings to Metric, 150mm, Sans serif, and 40.

**Impact:** A normal disclosure toggle loses completed work without warning or
Undo; offline users cannot recover even the previously generated profile.

**Expected / improvement:** Preserve generated data/settings for the unchanged
route when hiding a section; do not use visibility as a destructive reset.

**Code:** `src/app/components/PropertyControls.tsx:51-53`;
`src/app/components/ElevationProfilePanel.tsx:139-156,245-250`;
`src/app/components/RouteAdvancedProperties.tsx:275-282`.
**Artifacts:** `ux-advanced-elevation-before-collapse.png`,
`ux-advanced-elevation-after-collapse.png`.

**Resolution:** Verified. A per-project registry now owns profile sessions by
document epoch and route, independently of disclosure and selection. Same-source
data, settings and numeric drafts survive hiding the view and failed/canceled
refreshes. File changes are transactional, and exact job/source ownership retires
obsolete reads, terrain requests and exports. Geometry/source changes invalidate
heights without erasing preferences; deletion or project replacement disposes
the session. Profiles remain explicitly session-only, not autosaved project
content. The disclosure is readable at desktop and narrow widths.
Evidence: `ux-fix-039-results.json`, `ux-fix-039-artifact-verification.json`,
and `ux-fix-039-040-parent-verified/`. Independent review found no significant
issues; final combined coverage passed 54 unit and 14 Chromium cases.

### UX-040 - Elevation distances and travel estimates cut across route bends

**Severity:** Medium. **Evidence:** Direct execution of the real elevation
module with recorded synthetic geometry and flat controlled terrain.

**Reproduce:** Generate a profile for the right-angle route
`[[16.37,48.2],[16.371,48.2],[16.371,48.201]]` and compare its distance with the
original two segments.

**Actual:** The original route measures 185.31m but the profile reports 169.05m,
8.77% low. A deliberately extreme 201-point switchback fixture measures 59,322.23m
but reports 2,301.51m, 96.12% low.

**Cause:** Terrain sample positions are placed along the route, but cumulative
distance is then recalculated between samples, cutting across skipped corners.

**Impact:** The profile x-axis, printed distance, and distance-based travel
estimates can materially understate winding routes.

**Expected / improvement:** Retain original-route cumulative distances while
sampling elevations; fewer terrain samples must not redefine route length.

**Code:** `src/elevation/profile.ts:79-102,149-181`;
`src/app/components/ElevationProfilePanel.tsx:121-127,223-227`;
`src/export/elevationProfile.ts:109-126`.
**Artifact:** `ux-advanced-elevation-numeric-results.json`.
The extreme case is explicitly synthetic, not a claim about typical error rates.

**Resolution:** Verified. Sampling now retains target distances along the entire
original route and its total; terrain sample chords no longer redefine length.
The final sample is exactly the original total. The original corner now reports
185.31m. A separate 201-point synthetic switchback fixture reports 59,296.74m
instead of 1,259.00m; the actual UI shows 59.3km, walking 11h52min and cycling
3h57min, and its downloaded SVG ends at 59.3km. Closed antimeridian routes,
repeated positions, short routes and the 100-sample cap have regression coverage.
Terrain responses were controlled; this is not a provider-accuracy claim.
Evidence: `ux-fix-040-results.json`, `ux-fix-040-consumer-results.json`,
`ux-fix-040-consumer-distance.svg`, and the shared profile acceptance run.
Export text layout and PNG physical metadata are covered separately by UX-042/045.

### UX-041 - Closed-loop road matching is offered but cannot preserve normal loop results

**Severity:** Medium. **Evidence:** Browser control inspection and real store
execution with controlled successful matching geometry; UI failure wording
traced statically. No live matching-service test.

**Reproduce:** Close a Straight route and use Advanced > Road matching. Supply
a matched loop whose last coordinate repeats its first.

**Actual:** The normal closed result is rejected by a global-distinct-position
requirement. The rejection maps to "The project changed before the matched route
could be applied. Try again." A result ending 0.000001 degrees from its start
instead applies but changes the route to open.

**Impact:** Retry cannot resolve a deterministic geometry incompatibility,
while slight endpoint differences silently change topology.

**Expected / improvement:** Preserve/support loop closure, or clearly disable
unsupported matching before requesting it; report the actual incompatibility.

**Code:** `src/app/components/RouteAdvancedProperties.tsx:245-258`;
`src/app/components/RouteMapMatchingControl.tsx:64-78,136-150`;
`src/app/storeMapMatchingAction.ts:18-31,55-63`.
**Artifact:** `ux-advanced-domain-results.json`.

**Resolution:** Verified. Matching normalizes coordinates first, then uses the
shared route-aware validator rather than blanket uniqueness. Exact closing
aliases are accepted once and the source's topology is retained. Endpoints that
still differ after existing six-decimal normalization reject with a closure
explanation; the original loop/history remain intact. Open loop remains a
separate, explicit undoable choice. No new tolerance or unmatched connector was
introduced. Existing invalid interior repeats remain clearly rejected.
Evidence: `UX041-results.json`, `UX041-manifest.json`, `UX041-browser/`,
and the parent's `ux-fix-041-044-browser/`. The parent inspected matching source,
six delivered hashes, native geometry/provenance and reran all nine matching
browser cases. Provider responses were controlled; native rendering was real.

### UX-042 - Exported elevation-profile summary overlaps its axis labels

**Severity:** Medium. **Evidence:** Browser-generated SVG/PNG with controlled
terrain; visual inspection and SVG text-bound intersection measurements.

**Reproduce:** Generate a profile; select Imperial, Serif, and font size 60;
download its SVG or PNG.

**Actual:** The distance/ascent/descent summary overlaps both the 0.0mi and
0.7mi axis labels. Tick baselines sit at y=394.5 and the summary at y=400, only
5.5 SVG units apart. The compact on-screen preview omits these rows.

**Impact:** The print asset is visibly defective, but the editor preview does
not reveal the collision before downloading.

**Expected / improvement:** Use font-aware layout and reserve separate rows
for summary/axis labels across the full supported font-size range.

**Code:** `src/export/elevationProfile.ts:302-305,312-322`;
`src/app/components/ElevationProfilePanel.tsx:77-108`.
**Artifacts:** `ux-advanced-profile-output.png`,
`ux-advanced-profile-export-overlap.png`,
`ux-advanced-profile-overlap-results.json`.
This finding is confirmed for SVG/PNG, not asserted for PDF.

**Resolution:** Verified. The full SVG/PNG scene now also renders the preview,
including title, axes, summary and attribution. Font-aware bands reserve separate
rows; the original axis-to-summary gap now measures 12.8 SVG units. Weighted
native text metrics, fallback-face measurements and conservative non-native
bounds fit text without truncation. A bounded document-owned measurement cache
responds to font loading. Independent review exposed broad-capital clipping that
the initial matrix missed: a 200-character title's right edge was 1067.7 on the
900-unit scene. The corrected edge is 810.9 with all 200 characters retained.
The expanded 123-case browser matrix measured 1,907 text boxes with no
intersections or overflow; independent re-review found no significant issues.
The parent inspected print and 320px preview screenshots, measured text gaps,
and confirmed all 16 delivered source/test hashes.
Evidence: `ux-fix-042-results.json`, `ux-fix-042-review-correction.json`,
`ux-fix-042-parent-acceptance.json`, and the associated before/after screenshots.
All 122 scoped unit and 18 browser cases passed. PDF retains its existing
separate compact layout; no full PDF/SVG visual-parity claim.

### UX-043 - Tabbing through unchanged Road coordinates triggers rerouting

**Severity:** Medium. **Evidence:** Browser with deterministic Road fixture;
real missing-token failure and statically traced provider invocation.

**Reproduce:** Select a committed Road route, focus Waypoint 1 longitude, and
press Tab without changing its value.

**Actual:** The field's blur handler enters rerouting and creates pending
Retry/Cancel edit state despite no coordinate change. In the no-token setup this
immediately produces the provider-configuration error.

**Impact:** Keyboard inspection acts like an edit, producing spurious errors
offline and unnecessary provider work when configured.

**Expected / improvement:** Treat unchanged coordinate commits as no-ops before
creating a pending edit or invoking the provider.

**Code:** `src/app/components/CoordinateField.tsx:60-71,90`;
`src/app/hooks/useDirectionsRouteEditing.ts:74-79,152-159`;
`src/app/hooks/directionsRouteEditingSupport.ts:132-162`.
**Artifact:** `ux-advanced-road-noop-focus-error.png`.
The issue is the request path for an unchanged value, not the absent local token.

**Resolution:** Verified. Coordinate fields validate first, then normalize
unchanged text without calling the editing action. Canonical waypoint equality
also preserves the pending edit's identity, so non-field callers cannot trigger
duplicate routing or erase an existing error. Equal commits leave in-flight and
failed requests alone; Retry explicitly resubmits. Closing aliases and
six-decimal normalization use the same rule.
The browser recorded zero requests after unchanged Enter/Tab navigation and
equivalent numeric text, one after a genuine failed edit despite more keyboard
inspection, two after a latitude correction and three after explicit Retry.
One Undo restored the entire original document. Evidence:
`ux-fix-043-results.json`, `ux-fix-043-before.log`,
`ux-fix-043-browser-final.json`, and `ux-fix-043-browser-final/`.
All 40 scoped unit and six Chromium ownership cases passed with controlled
Directions responses; no live-provider or physical-device claim.

### UX-044 - Minimum-size closed routes offer a Remove action that silently does nothing

**Severity:** Low. **Evidence:** Browser-reproduced; code-confirmed.

**Reproduce:** Close a three-distinct-anchor Straight route, select Anchor 2 in
Advanced > Vertices, and click the enabled Remove action.

**Actual:** The UI counts the repeated closing point as a fourth entry and
enables removal. The domain correctly rejects dropping below three distinct
closed points, but no explanation appears and nothing changes.

**Impact:** The action looks broken and invites repeated attempts.

**Expected / improvement:** Disable removal at the distinct-point minimum and
explain the constraint before the user attempts it.

**Code:** `src/app/components/RouteVertexControls.tsx:33-40,114-128`;
`src/domain/routePointRemovalTransformations.ts:118-120`;
`src/app/storeRouteGeometryActions.ts:40-42`.
**Artifact:** `ux-advanced-closed-minimum-remove.png`.

**Resolution:** Verified. `routePointConstraints` now supplies the minimum and
removal eligibility to canonical validation, topology mutation, Road request
preparation and the inspector. Closed aliases do not count as extra points.
The disabled action references a visible, readable explanation; above-minimum
removal remains enabled. Straight, Arc and Road loops passed minimum/one-removal/
Undo workflows, including a 320px inspector. Road requests are rejected before
IO at the minimum or for fractional indices. Evidence:
`ux-fix-044-results.json`, `ux-fix-044-before.log`, and
`ux-fix-041-044-browser/`; 105 scoped unit and four dedicated browser cases.

### UX-045 - Elevation PNG omits the physical print size selected in the UI

**Severity:** Low. **Evidence:** Browser-generated output and binary PNG
metadata inspection.

**Reproduce:** Select a 220mm Profile print width and download the profile PNG.

**Actual:** The file is 2640 x 1320px but has no `pHYs` physical-resolution
metadata. The inspected macOS tool assumes 72 DPI, giving approximately 931mm
instead of 220mm. Other receiving applications may use different defaults.
The equivalent SVG explicitly encodes 220mm.

**Impact:** Users must manually resize the PNG in a layout application despite
having already specified its print width in the editor.

**Expected / improvement:** Encode matching physical-size metadata or clearly
label the PNG output as pixel-sized and explain the required placement size.

**Code:** `src/app/components/ElevationProfilePanel.tsx:189-194`;
`src/export/elevationProfile.ts:312-322`;
`src/export/rasterizeElevationProfile.ts:12-24`.
**Artifacts:** `ux-advanced-profile-output.png`,
`ux-advanced-elevation-numeric-results.json`.

**Resolution:** Verified independently of the title correction tracked in UX-042.
The existing PNG metadata helper now encodes 304.8 DPI, matching the actual
12 pixels/mm raster scale. Native 50/220/300mm downloads contain exactly one
12,000 pixels/metre `pHYs` chunk after `IHDR`, with valid CRCs and unchanged
compressed image data. The parent independently confirmed their physical widths
from the binary files. Evidence: `ux-fix-045-results.json`,
`ux-fix-045-parent-acceptance.json`, and `ux-fix-045-{50,220,300}mm.png`.
Receiving applications must honor standard PNG metadata.

### UX-046 - Scalable SVG markers are rejected by a raster-style minimum size

**Severity:** Medium. **Evidence:** Browser-reproduced with a simple,
self-contained vector icon; code-confirmed.

**Reproduce:** Upload a valid SVG consisting of a circle in
`viewBox="0 0 24 24"` as a custom place marker.

**Actual:** It is rejected with "Custom markers must be at least 100 x 100
pixels." The SVG has scalable geometry, not a 24px raster-resolution limit.
The UI offers no preparation guidance before opening the file picker.

**Impact:** Common 24px/32px vector icon exports require source editing or
re-exporting solely to satisfy an arbitrary coordinate-space minimum, despite
being renderable at the editor's supported marker sizes.

**Expected / improvement:** Validate scalable geometry independently of raster
pixel minimums, or rasterize safe SVGs at the required internal resolution.
Explain genuine format/size constraints before upload.

**Code:** `src/domain/customMarkerAssets.ts:72-81,159-169,239-250`;
`src/app/components/PoiAppearanceControls.tsx:65-75`.
**Artifacts:** `ux-markers-24px-vector-rejected.png`,
`ux-markers-pass-results.json`.
The icon contains only an SVG root and circle; unsupported SVG features or
active content are not the reason for rejection.

**Resolution:** Verified. SVG source units, including fractional extents, are
validated separately from raster pixel quality. One helper drives bounded
100px-long-edge native allocation, exact-aspect placement, decoded capacity and
icon scale. Original valid SVG bytes, dimensions and hash remain portable and
embedded in vector output; PNG/JPEG retain their 100..2048px requirements.
Independent review caught native-only namespace repair admitting sources that
could disappear from SVG output. Shared validation now requires the SVG
namespace throughout and native repair was removed. Rejected replacements leave
the previous marker and history intact. Actual isolated SVG/PNG renders of the
original 24-unit icon contain the expected square circle bounds and color.
Evidence: `ux-fix-046-acceptance.json`,
`ux-fix-046-048-parent-acceptance.json`, and `ux-fix-046-namespace-final/`.
Final shared coverage comprises 186 distinct unit and nine browser cases.

### UX-047 - Custom markers leave ineffective appearance controls enabled

**Severity:** Medium. **Evidence:** Browser-reproduced; before/after marker
screenshots have identical bytes and SHA-256 hashes.

**Reproduce:** Upload the supported 100 x 120 custom marker fixture, set its size
to 48, then change Color to red, Shape to Square, and Symbol to Coffee.

**Actual:** All three controls remain enabled and their values are committed,
but the visible marker is unchanged. The custom image supersedes the standard
shape, color, and symbol. No explanation indicates that these settings are
inactive; only Size and Label still affect the custom-marker presentation.

**Impact:** Users repeatedly edit controls that appear applicable but have no
visible effect. Removing the custom image later exposes the accumulated hidden
standard-marker changes.

**Expected / improvement:** Disable or hide overridden controls with a clear
explanation and an explicit switch back to the standard marker.

**Code:** `src/app/components/PoiAppearanceControls.tsx:119-124`;
`src/map/MapContentLayerRendering.ts:115-126,163-165,208-216`;
`src/print/poiMarker.ts:65-80`.
**Artifacts:** `ux-markers-custom-controls-active.png`,
`ux-markers-custom-before-controls.png`,
`ux-markers-custom-after-controls.png`, `ux-markers-pass-results.json`.

**Resolution:** Verified. Custom images disable Color, Shape and Symbol with an
associated explanation; Size, Label and Opacity remain usable. Ordinary marker
styling is retained, not overwritten, and removing the custom image or using
Undo/Redo restores the appropriate controls and appearance. Desktop/mobile
workflows confirm readable 12px guidance, a 44px removal target and working
native/exported presentation. Evidence: `ux-fix-047-acceptance.json`,
`ux-fix-046-048-parent-acceptance.json`, and the shared marker browser artifacts.

### UX-048 - Exceeding custom-marker capacity silently ignores a valid upload

**Severity:** Medium. **Evidence:** Browser with a valid 64-asset project fixture
opened through the normal project chooser; resulting download examined.

**Reproduce:** Open a project with 64 distinct referenced custom markers.
Select another place without a custom marker and upload a valid new SVG.

**Actual:** The file passes individual validation, but the aggregate asset
validator rejects the 65th asset. The store silently returns its unchanged
state. The UI returns to Upload marker with no alert, capacity explanation, or
recovery action. A subsequent download still has 64 assets and the target's
`customAssetId` remains null.

**Impact:** A normal upload appears ignored, encouraging repeated attempts
without telling the user what limit was reached or how to proceed.

**Expected / improvement:** Return an explicit admission result to the upload
control and explain the applicable asset-count/byte/pixel budget. Offer reuse,
replacement, or removal guidance.

**Code:** `src/app/storeLayerActions.ts:269-280`;
`src/domain/customMarkerAssets.ts:226-236`;
`src/app/components/PoiAppearanceControls.tsx:45-51`.
**Artifacts:** `ux-markers-capacity-silent-rejection.png`,
`ux-markers-capacity-fixture.printmap.json`, `ux-markers-pass-results.json`.
Unlike UX-026, this guard correctly preserves a valid document; the defect is
the silent failure and lack of actionable feedback.

**Resolution:** Verified. The dedicated action submits a pruned candidate to
shared canonical admission instead of swallowing validation failures. Specific
count, encoded-byte, decoded-pixel and portable-byte errors reach the upload
control with recovery guidance. Genuine same-asset reuse remains a no-op and
exclusive replacement frees its old asset before evaluating capacity. Upload
ownership includes the document epoch, layer and current asset, retiring stale
file/decode completions. The parent independently compared byte-identical
before/rejected downloads for all four real limits, including exactly
10,485,760 portable bytes, and confirmed retry after freeing capacity.
Evidence: `ux-fix-048-acceptance.json`,
`ux-fix-046-048-parent-acceptance.json`, and `ux-fix-046-048-parent-browser/`.

### UX-049 - Large layer lists have no filter or compact keyboard navigation

**Severity:** Medium. **Evidence:** Browser with a valid 300-place project;
focus order and scroll geometry measured.

**Reproduce:** Open a project with 300 named places and try to find/edit a place
near the end using the Layers sidebar or forward Tab navigation.

**Actual:** The 301-row list including the basemap exposes 1,203 enabled tab
stops, with separate visibility, select, lock, and reorder stops for each place.
The last place's Select action is the 1,198th stop in that list. Its scroll
content is 9,038px high inside a 787px viewport. There is no layer-name filter
or app-provided compact row-navigation/jump control.

**Impact:** Ordinary permitted batch imports make locating and navigating
specific layers disproportionately difficult, especially for keyboard users.
The global place/address search does not search document layers.

**Expected / improvement:** Add a layer filter and compact, documented keyboard
navigation between rows, with contextual access to row actions and a way to
skip to the next editor region.

**Code:** `src/app/components/LayersSidebar.tsx:61-86,159-192`.
**Artifacts:** `ux-layers-300-navigation.png`, `ux-layers-tablet-results.json`.
The list does scroll correctly; this is a navigation-efficiency finding, not
a claim that the last rows are inaccessible by all means.

**Resolution:** Verified. Layers now has case-insensitive name filtering, a
result count, Clear and documented arrow/Home/End navigation. One active row
contributes at most four Tab stops: the original 300-place document now takes
five Tabs from the filter to the map instead of traversing 1,203 row stops.
Focus movement does not select, change the document or write autosave; Enter
selects explicitly, including direct mobile navigation to Properties.
Filtered drag and keyboard destinations map back to canonical document indices,
preserving hidden-layer order, the fixed basemap and Undo/Redo. Filter/focus
state is local to the document epoch.

Independent review exposed two defects in the first implementation. The final
guard also protects another selected layer from Delete/Backspace during active
dragging. Drop/Escape cleanup retains ownership through actual completion;
new filter/Properties focus or document replacement invalidates old restoration.
The normal 250ms transition and subsequent gestures remain functional without
focus-back timers. Independent re-review found no significant issues.

All 120 unit and 40 integrated browser cases passed without exclusions; the
parent reran nine original/review cases, inspected desktop/320px screenshots,
confirmed 15 delivered hashes and compared byte-identical protected documents.
Two legacy resource-status expectations were updated and actual retry recovery
was exercised. Touch measurements now await the real customizer animation,
retaining the exact 44px requirement.
Evidence: `ux-fix-049-results.json`, `ux-fix-049-evidence.json`,
`ux-fix-049-parent-acceptance.json`, and `ux-fix-049-parent-review-final/`.
Browser evidence uses Chromium, the installed DnD engine and native map
rendering; simulated mobile contexts are not physical-device certification.

## Unconfirmed follow-up queue

- Export progress is a descendant live region inside an `aria-busy` dialog
  (`src/app/components/ExportDialogView.tsx:232-260`). Some assistive technology
  may defer these announcements. The markup is confirmed; actual screen-reader
  behavior has not been exercised, so this is not counted as a confirmed issue.

## Audit log

### Pass 1 - Setup and workflow discovery

- Read the product's UI brief and editor architecture.
- Started independent inspection of import, export, and persistence workflows.
- The first local server launch encountered missing project dependencies;
  preparing the existing toolchain before browser investigation.
- Installed the existing locked dependencies and launched the local editor.
- Reproduced UX-001 through UX-007 in the browser.
- Confirmed ordinary P/R tool shortcuts work; they are not reported as broken.
- Confirmed the layer list already scrolls; lack of layer-list scrolling is not
  a finding.

### Pass 2 - Input boundaries, protection, and constrained layouts

- Disabled development React Scan overlays and captured clean screenshots.
- Reproduced shortcut leakage through Export, inconsistent layer locking,
  customizer focus-loop failure, and the nearly zero-width search field.
- Added 320 x 568 and 844 x 390 viewport passes, including geometry measurements.
- Independent file-workflow inspection identified further candidates; separate
  browser reproduction is underway before integrating its browser claims.

### Pass 3 - Persistence claims, search semantics, and action discoverability

- Reproduced an unfinished three-point route disappearing on reload despite
  "All changes saved locally".
- Exercised search pending state, dismissal, and distant-place creation using
  controlled responses; no live-provider behavior is inferred from these cases.
- Measured primary text contrast and maximum-length title layout.
- Confirmed ordinary document Undo while drafting leaves route points intact;
  it is not reported as draft loss.
- Advanced committed-route, elevation, and administrative-picker inspection is
  continuing independently.

### Pass 4 - Recovery and cross-browser startup

- A single deliberately failed map tile reproduced a persistent fatal-style
  error even after network access was restored.
- Confirmed the mobile drawer-selection sequence behind UX-014.
- Firefox desktop and WebKit iPhone-emulated startup both rendered the map.
- The session is scheduled to resume further audit passes every 10 minutes
  until the user explicitly asks to stop.

### Pass 5 - File lifecycle and persistence contracts

- Integrated specialist browser evidence for valid-project replacement,
  cumulative layer/name limits, recovery dead ends, cross-tab conflicts, import
  review inconsistencies, and obscured error notices.
- Combined layer-count and layer-name admission failures under UX-026 because
  both violate the same accepted-edit/saveability contract.
- Preserved the distinction between code-confirmed address-review behavior and
  untested live geocoding accuracy.
- Kept the screen-reader progress hypothesis out of the confirmed issue count.
- Detailed evidence: `ux-files-browser-results.json` and
  `ux-files-browser-summary.txt`.

### Pass 6 - Advanced routes and elevation outputs

- Integrated nine route/profile findings with explicit browser, fixture,
  controlled-terrain, and exported-output evidence boundaries.
- Administrative catalogue retry recovered correctly after an injected first
  shard failure; ASCII Kyoto found the macron-spelled catalogue entry, and
  uncommitted country text did not submit mismatched boundaries. No defect
  recorded for these behaviors.
- Excluded an inactive legacy route-extension code path rather than reporting
  its apparent issue as a reachable UI defect.
- Detailed evidence: `ux-advanced-findings.json`.

### Pass 7 - Custom markers, large lists, and coarse-pointer tablet use

- Added UX-046 through UX-049 from isolated browser workflows and recorded
  marker pixels, asset-count outcomes, and large-list focus order.
- Extended UX-007 with tablet chrome measurements instead of duplicating the
  existing touch-target finding.
- Invalid custom-marker replacement preserved the previous valid image;
  removing a custom image restored the stored standard marker. No defect
  recorded for those protected behaviors.
- A trusted CDP touch drag in a 1024 x 768 coarse-pointer context successfully
  moved a place through its 44px handle. This is browser emulation, not a claim
  of physical-tablet testing.
- Detailed evidence: `ux-markers-pass-results.json` and
  `ux-layers-tablet-results.json`.

### Remediation - Project replacement and saveability

- Verified UX-025 with explicit backup/cancel/replace behavior, including
  restored projects without history and the existing unfinished-work warning.
- Corrected initial native camera diagnostic publication after the renderer
  lifecycle ordering change. Camera construction itself was correct; initial
  attributes were missing until a later camera update. The renderer installation
  now initializes those attributes without replaying a camera command. All 48
  targeted camera/startup/recovery unit cases and four camera-recovery browser
  workflows passed.
- A broader route regression run exposed stale Settings-disclosure steps and
  a separate SVG-to-PDF export-lifecycle failure. The export issue is now
  corrected at the shared restoration/readiness boundary, with actual PDF/PSD,
  cancellation, and context-loss evidence. Parent reviewed the correction.
- Began UX-026 implementation to prevent accepted edits from violating the
  shared parser/autosave constraints. Structural admission and authoring
  rejection handling are being addressed together rather than only blocking
  invalid downloads.
- Verified UX-026 after an independent review and correction of stale Road
  preview rollback. Refreshed UX-025 screenshots now capture settled dialog
  opacity, and its six replacement cases and the corrected route-draft
  disclosure workflow passed again.
- Verified UX-027 non-destructive damaged-draft recovery. Visual follow-through
  corrected a clipped-action case under long errors and moved offline guidance
  into the existing canvas notice flow rather than covering search.
- Verified UX-028 protection for a losing tab's unsaved version, including
  permanent retirement of the stale writer and guarded in-app adoption.
- Began UX-029 compact-size consistency and rejection feedback. The byte budget
  must cover all canonical mutation paths, including otherwise-valid scalar
  edits and native camera movement, rather than only changing download format.
- Verified UX-029 after exact-byte artifact inspection and independent review.
  The serialization budget, field feedback, and native rollback are one
  consistent contract.
- Began UX-030 and its tightly coupled UX-031 import-style validation fix, with
  separate acceptance cases for input-method parity and blank numeric values.
- Verified UX-030/031 after source review and responsive follow-through;
  the parent corrected undersized new validation text before accepting it.
- Began UX-032 selected-format PDF preflight and practical failure guidance.
- Verified UX-032, including a corrected-size physical PDF and fixed
  short-screen action placement.
- Began UX-033 address-match review with its coupled UX-035 per-mode pasted
  input preservation. UX-034 remains a separate notification-ownership fix.
- Verified UX-033/035 after fixing the review-discovered route-extension bypass
  and mode-specific message leakage. Actual endpoint continuation and stored
  output were inspected before acceptance.
- Began UX-034 shared file feedback presentation.
- Verified UX-034 error-first, non-overlapping file feedback and keyboard/touch
  dismissal. Began UX-036 fresh-project creation with outgoing-work protection.
- Verified UX-036 New project, including full default reset and subsequent
  autosave restoration. Began UX-037 obsolete Road-edit state retirement.
- Verified UX-037 against the original Arc contamination sequence and late
  request/metadata/history boundaries. Began UX-038 closed-route move styling.
- Verified UX-038 after the independent review exposed and the author corrected
  actual pointer cancellation. Began a coordinated profile pass: UX-039 owns
  UI/model lifetime; UX-040 owns the independent distance calculation.
- UX-040 regression tests first reproduced 169.05m instead of 185.31m for the
  original right angle. Original cumulative target distances now survive
  sampling; the actual UI and downloaded SVG now agree with the full-route
  distance. Accepted UX-039/040 after independent ownership review, 54 unit cases
  and 14 Chromium cases, including readable session-only disclosure.
- Began UX-041 at the matching/topology boundary: exact closing aliases must
  remain supported, while incomplete provider loops must not silently open the
  route or gain an invented connector.
- Verified UX-043 independently while the matching/profile-output work remained
  active. The correction is enforced both in shared scalar inputs and before
  routing request ownership changes, preserving failed edits and explicit Retry.
- Accepted UX-041 and UX-044 after source/native review and a combined 13-case
  browser run. Matching preserves deliberate topology; removal eligibility
  shares the canonical minimum instead of counting a closing alias.
- Accepted UX-045's physical metadata independently. UX-042 remains open while
  a review-discovered broad-capital title clipping case is corrected.
- Accepted UX-046/047/048 after correcting the review-discovered SVG namespace
  admission mismatch and measuring real vector/raster paint. All four capacity
  rejections preserve downloaded bytes; old standalone provider-fixture failures
  were resolved. UX-049 layer filtering/navigation implementation is active.
- Accepted UX-042 after correcting broad-capital width estimation and expanding
  the actual rendered-text matrix to 123 cases. Independent re-review is clear.
  Forty-eight of the 49 findings are now verified; UX-049 remains active.
- UX-049's first independent review found two interaction regressions: destructive
  keys during a native drag could reach a different selected layer, and delayed
  drop/cancel focus restoration could steal newly acquired filter focus. Both
  remain under correction; the issue is not marked verified. The parent also
  restored two old resource-recovery tests to the current status contract and
  resolved a touch-measurement race by awaiting the actual customizer animation,
  retaining the exact 44px requirement.

### Remediation acceptance

- Accepted UX-049 after both native-drag review findings were corrected and
  independent re-review was clear. The final integrated run passed all 40 cases
  without exclusions, including the restored recovery and exact touch-size
  checks; the parent separately reran the nine original/review scenarios.
- All 49 recorded findings now have verified resolutions. The issue ledger and
  product UI brief are updated. Audit discovery remains stopped; the unconfirmed
  follow-up above is not being promoted to a finding or a completion claim.
- Evidence remains scoped as documented: controlled provider responses where
  applicable, real browser/native-engine behavior where exercised, and explicit
  limits on physical-device, assistive-technology and full-suite coverage.
