# Character Page v2 — implementation handoff

Design reference (interactive, click-through): https://claude.ai/code/artifact/e5b31900-449b-42b2-bd49-0e13abda1faf

## Files in this folder

- **`reference.html`** — start here for desktop. A standalone static page (plain HTML/CSS/vanilla JS, no build step, no dependencies) with the full v2 markup for every desktop section below. Open it directly in a browser, or just read/copy the markup out of it.
- **`reference-mobile.html`** — the mobile equivalent, same idea (standalone, plain HTML/CSS/vanilla JS). Covers all four modes including Inventory. See the "Mobile layout" section below for what's structurally different from desktop and why.
- **`CHARACTER_PAGE_V2_HANDOFF.md`** — this file. Section-by-section mapping from the design back to the real component/style files in `src/`.
- **`Main.dc.html`, `Before.dc.html`, `Mobile.dc.html`, `canvas.json`** — the original design-tool source behind the interactive artifact above (uses a template syntax specific to that tool — `{{holes}}`, `<sc-if>`, `<sc-for>` — not plain HTML). Included for completeness; the two `reference*.html` files are the ones to actually build from.

All of these use the site's real DarkArcane theme tokens (`var(--jnj-color-*)` etc. from `styles/themes/DarkArcane.scss` / `BaseTheme.scss`) — no new colors, no new fonts. The `reference*.html` files hardcode the token *values* directly (since they have no build step); when porting into the app, swap those literals back for the `var(--jnj-color-*)` custom properties.

## What's real data vs. placeholder in the mockups

- **Real** (pulled from the live character in the screenshot this design was based on): Skills & Flaws names/degrees, ability scores (STR 3 / DEX 1 / INT 0 / CHA 3), HP 17/17, AC 17, XP 0, Hardness 0, and the full Background/Notes text.
- **Placeholder, bind to real fields**: "Character Name" / "Class Name" in the masthead. `character_name`, `class`, and `player_name` already exist on the character document (see `CharacterPageLayout.json`) but are currently never rendered anywhere on the page — only used as `document.title`.
- **Sample/illustrative only — not real data**: the Combat Mode actions (Read the Room, Quick Draw, Fade Step, Sucker Punch, All-In Gambit, Vanish), the Combat Map zone contents (Bandit Scout, Mira, Merchant), and the mobile Inventory contents (Ashwood Charm, Signet of Doubt, Rope, Rations, etc.). These stand in for whatever `characterPage.actions` / campaign combat entities / `characterPage.inventory` actually contain — swap in real data, keep the layout/states (including the empty-slot treatment).

## 1. Masthead — new, no current equivalent

**Today:** `CharacterPageNavigation.js` renders one empty `<div className="CharacterPage-navigation">` tinted by `characterPage.navigation_color`. Nothing else is in it — that's the dead purple bar in the original screenshot.

**v2:** A card with an avatar circle, character name (Cinzel, ~30px), a "Class · Player: name" subline, and a small round customize-color button tucked in the top-right corner (replaces `CharacterPageNavigationColorPickerButton.js`'s old full-width treatment — same color-picker functionality, just relocated so it doesn't dominate the header).

- Files touched: `CharacterPageNavigation.js` (rewrite), `CharacterPageNavigationColorPickerButton.js` (keep the picker logic, change where the trigger renders), `styles/CharacterPage.scss` (replace `.CharacterPage-navigation` rules).
- Props needed: `characterPage.character_name`, `characterPage.class`, `characterPage.player_name`, `characterPage.navigation_color` (existing field — now used as a gradient start color + badge-ring accent instead of a flat full-bleed fill).
- No portrait field exists in the schema yet — the avatar is a placeholder person-silhouette icon with a small pencil badge. If you want real portraits later, that's a new `portrait_url` field + upload flow, out of scope here.
- See `reference.html`, the first `<div>` inside "RIGHT CONTENT" (search for `MASTHEAD`).

## 2. Vitals card — replaces the two floating stat boxes

**Today:** `CharacterPageAbilityScorePanel.js` (400×190px, fixed) and `CharacterPageStatsPanel.js` (500×190px, fixed) render as two separate boxes. At real desktop widths this leaves a large dead gap to their right — see the "Before" artboard on the design canvas.

**v2:** Both panels merge into one `flex-wrap` card: an HP bar (new — was plain current/max/temp numbers, now a labeled progress bar), then AC (same idea as today, a shield with the number layered on top — just recentered/resized), then XP/Hardness as plain label+value pairs (visually unchanged from today), then the four ability scores in the same icon → label → divider → value order as today, just no longer boxed into their own fixed-width panel.

- Files touched: merge `CharacterPageAbilityScorePanel.js` + `CharacterPageStatsPanel.js` into one component (or keep them as two components rendered inside one shared flex container — either works, the point is removing the two separate 400px/500px fixed-width boxes).
- **Keep all existing behavior as-is**: the debounced `updateDoc` calls, the `<input type="number">` elements, `disabled={!hasWritePermissions}`, the `tooltips` conditionals — the mockup shows static numbers for clarity, but every value shown should stay a real bound input in the implementation.
- HP bar: width = `current_health / maximum_health` (clamp 0–100%); the temp-HP treatment (`.CharacterPage-stats-temp-hp-yellow`) still applies, just needs a new visual (e.g. an ember-colored overlay segment or border) since there's no separate box to re-border anymore.
- See `reference.html`, the `<!-- VITALS CARD -->` block.

## 3. Skills & Flaws sidebar — grouped headers

**Today:** `SkillsAndFlaws.js` renders one flat list; skill vs. flaw is only distinguishable by border/background color (gold vs. red), easy to miss at a glance.

**v2:** Same component, same `Collapsible` behavior and toolbar — just split `characterPage.skills_and_flaws` into two groups by `.isSkill` and render a small caps-label header ("Skills" / "Flaws") above each group. An empty group shows a muted "None recorded yet" placeholder row instead of nothing.

- Files touched: `SkillsAndFlaws.js` only (add a `.filter()` + two render passes instead of one `.map()`), `styles/SkillsAndFlaws.scss` (add the group-header style).
- See `reference.html`, the sidebar `<div>` at the top of "RIGHT CONTENT" — actually the very first `<div>` in the body (search for `SKILLS & FLAWS SIDEBAR`).

## 4. Mode switcher — segmented pill control

**Today:** `TabContainer.js` renders plain text buttons (`.TabButton` / `.TabButtonSelected`) — an underline is the only selected-state indicator.

**v2:** Same `useState(selectedTab)` logic, same `tabs` array shape from `CharacterMainTab.js` — just restyle the buttons as a rounded segmented control with one icon per tab (scroll / crossed swords / bag / map, inline SVGs below) and a filled pill for the active tab instead of an underline.

- Files touched: `TabContainer.js` (add icon per tab — either extend the `tabs` prop shape with an `icon` field, or switch on `tab.tabName`), `styles/TabContainer.scss`.
- Icon paths are inline in `reference.html` — copy them as-is, or save each as a new file under `src/icons/` (e.g. `scroll.svg`, `swords.svg`, `bag.svg`, `map.svg`) if the codebase prefers imported `<img>` icons like the existing ability-score icons do.

## 5. Roleplay Mode — same fields, new card treatment

**Today (`CharacterMainTab.js`, `"Roleplay Mode"` tab):** two `TextareaAutosize` fields for `description` and `notes`, plain `<h2>` labels above each.

**v2:** Same two fields, same debounce/`updateDoc` wiring — wrapped in a card with a left accent bar (gold for Background, ember for Notes), an icon + Cinzel heading, and a small "Autosaves as you type" caption to reassure users the field is still live-editable (it always was — this was just never signaled visually).

- Files touched: `CharacterMainTab.js` (Roleplay Mode tab content), `styles/CharacterMainTab.scss`.
- **Do not swap the `TextareaAutosize` for static text** — the mockup renders plain text for legibility, but the real implementation keeps the actual editable textarea.

## 6. Combat Mode — action cards

**Today (`CombatActionList.js`):** flat clickable rows; clicking toggles an inline description; "Use Action" button is `position:absolute`, appears among the row content.

**v2:** Same three groupings (Passives / Available / Unavailable, same filtering logic already in `CharacterMainTab.js`), restyled as cards: name + cost stars + to-hit-or-DC + range on one line, tag chips (e.g. "Reaction"), description always visible below (no more click-to-expand — simpler, and there's room now that it's a card not a dense row), "Use Action"/"Use Reaction" button pinned bottom-right and always visible (not conditional on row-click state). Unavailable actions (`action.actionCost > characterPage.action_points`) get `opacity: 0.5` and a small lock icon instead of a button — same filtering `CharacterMainTab.js` already does, just a different treatment for the "can't afford it" case.

- Files touched: `CombatActionList.js` (restyle), `styles/CombatActionList.scss`.
- Action Points row: same `action_points` state and `setActionPoints()` writer already in `CharacterMainTab.js` — just bigger stars and a persistent "`X / 4`" label instead of only the 4 star icons.
- See `reference.html`'s `data-panel="combat"` block — note the JS `toggleAP()` there is a throwaway demo for the static file; the real component should keep calling `updateDoc(..., {action_points: n})` exactly as `CharacterMainTab.js` does today.

## 7. Combat Map — clearer zone cards

**Today (`CharacterMainTab.js` `"Combat Map"` tab + `MapRenderer.js` + `PostListContentCombat`/`PostListContentCombatMap`):** Line View / Map View toggle already exists and works; zone/tile styling is plain (`CombatMap.scss`).

**v2:** Same toggle, same `combat_view` field and `setCombatView()` writer — just clearer zone card headers and color-coded entity chips (accent = you, green = ally, red = enemy, muted = neutral/npc). The "Map View preview" grid in `reference.html` is illustrative only — the real Map View still renders from `map.link` + `zones` via the existing `MapRenderer.js` / `PostListContentCombatMap`; don't reimplement that renderer, just consider carrying the same entity-chip color coding into its zone labels if useful.

- Files touched: `styles/CombatMap.scss`, and wherever `PostListContentCombat`'s zone/tile markup lives (`utils/DraggableElements/PostListCombat.tsx`, not read for this pass — check there for the actual zone-card component).

## New icons

None of these exist in `src/icons/` today; they're plain stroke SVGs (24×24 viewBox, `stroke="currentColor"`, `stroke-width: 1.6`, round caps/joins) so they inherit color like the existing ability-score icons already do. Full paths are in `reference.html` — grep for: person (avatar), pencil (edit-portrait badge), palette (customize color), heart (HP), shield (AC — a resize of the existing shield icon, not new), gem (XP), brick wall (Hardness), scroll (Roleplay tab), crossed swords (Combat tab), bag (Inventory tab), map (Combat Map tab), star outline/filled (already exist as `star.svg`/`star_filled.svg` — reused, not new), chevron (already exists inline in `SkillsAndFlaws.js` as `›`), lock (unavailable-action indicator).

---

## Mobile layout

Reference: `reference-mobile.html`. Same tokens, same icon set as desktop — three things change shape at narrow widths, everything else (masthead identity, HP bar, AC/vitals treatment, journal-card Roleplay content, action cards) is the same design just restacked into a single column. This isn't a from-scratch mobile app — it's the same `CharacterPage`/`CharacterMainTab` component tree with a narrow-viewport layout, so implement it as a breakpoint (CSS media query / a `useMediaQuery`-style hook already common in the codebase, if any — none was found in this pass, so a simple `window.matchMedia('(max-width: 640px)')` hook is the likely addition) rather than a parallel set of components wherever the markup itself doesn't actually need to change.

### 8. Mode switcher → fixed bottom tab bar

**Why:** thumb reach. A row of pills at the top of a tall scrolling page means reaching across the screen every time you switch modes; a bottom bar is one-handed.

**What changes:** `TabContainer.js`'s button row becomes `position: fixed; bottom: 0` with one icon+label per tab (same 4 icons as desktop, same `tabs` array/`useState(selectedTab)` logic), `min-height: 60px` per button for a real touch target. Content area needs `padding-bottom` to clear the fixed bar (see `reference-mobile.html`'s outer wrapper — `padding: 18px 16px 100px`).

- Files touched: `TabContainer.js` / `styles/TabContainer.scss` (add the mobile-breakpoint variant of the button row).

### 9. Skills & Flaws → summary row + slide-up drawer

**Why:** the 300px persistent sidebar has nowhere to go at 390px width without eating the whole screen.

**What changes:** on mobile, `SkillsAndFlaws.js` doesn't render inline — instead a compact button ("Skills & Flaws · 3 · 0" with a chevron) sits near the top of the page, and tapping it opens the actual `SkillsAndFlaws.js` content in a full-screen slide-up panel (scrim + panel, closes on scrim tap or an X button). The grouped Skills/Flaws headers from section 3 above carry over unchanged inside the drawer.

- Files touched: new wrapper around `SkillsAndFlaws.js` for the mobile case (a `SkillsAndFlawsDrawer.js` or a mode flag on the existing component), `styles/SkillsAndFlaws.scss` (drawer/scrim styles).
- State needed: one boolean (`skillsOpen`) — see `reference-mobile.html`'s `openDrawer()`/`closeDrawer()` for the interaction, `Mobile.dc.html`'s `skillsOpen` state for the same logic in the design-tool source.

### 10. Combat Mode — same cards, mobile-specific sizing

Same content and states as desktop section 6, with two mobile-specific adjustments: the AP star buttons need an explicit `44×44px` tap target (the star icon itself is smaller, wrap it in a full-size button — see `reference-mobile.html`'s `.ap-star` buttons), and the "Use Action" button moves from `position: absolute` bottom-right (no room for that at 390px alongside text) to a full-width button at the bottom of the card's normal flow.

### 11. Inventory — redesigned for mobile (new; desktop Inventory tab is unchanged/still a stub)

**Today:** `CharacterMainTab.js`'s `"Inventory"` tab renders `PostListContentInventory` (three side-by-side `PostColumn`s via `@hello-pangea/dnd`: `["Relic 1..4"]`, `["1..4"]`, `["5..8"]`) plus `PostListContentInventoryPocket` (`["Pocket"]`) next to it — a multi-column drag-and-drop board. That doesn't fit a 390px screen with the columns side by side.

**v2 (mobile only):** restructured into three stacked sections instead of columns:
- **Relics** — a 2×2 grid of slot cards (`Relic 1`–`Relic 4`), each showing the slot label and the item title (or a dashed "Empty" state if the slot has no `Post`).
- **Backpack** — the 8 numbered slots (`1`–`8`) as a vertical list of rows (slot number badge + item title), not a grid — easier to scan and drag-reorder in a single column than a dense grid would be.
- **Pocket** — kept as its own visually distinct card, carrying over the existing warm "parchment" treatment from `styles/CharacterMainTab.scss`'s `.CharacterMainTab-PostColumn-inventory-pocket` (`#e4d9bd` background) rather than inventing a new color.

Each `Post` still has `{id, title, content, status, index}` (see `utils/DraggableElements/Post.ts`) — the mockup only shows `title`; consider whether `content` (the item description) belongs inline, in a tap-to-expand, or is dropped for the compact mobile view — that's a product call this design doesn't make for you.

- **Drag-and-drop**: the desktop board uses `@hello-pangea/dnd` (`Droppable`/`Draggable` in `PostColumn.tsx`/`PostCard.tsx`) for reordering/moving items between columns. Whether that's worth preserving on mobile (touch drag-and-drop is finicky) or whether slots get a tap-to-move / long-press menu instead is also a product call — the mockup shows static placement only and doesn't take a position on this.
- Files touched: likely a new mobile-specific rendering path alongside `PostListContentInventory`/`PostListContentInventoryPocket` (reusing `PostColumn`/`PostCard`'s underlying `usePosts`/`updatePosts` data layer from `PostListContentAbstract.tsx`, just with different presentation components for narrow viewports), `styles/PostCardInventoryDefaults.scss` / `styles/CharacterMainTab.scss` (new mobile section styles).

### New mobile-only icon

One addition beyond the desktop icon list: a chevron-right icon for the Skills & Flaws summary row (reuses the same chevron path already inline in `SkillsAndFlaws.js`, just standalone rather than inside a `Collapsible` trigger).
