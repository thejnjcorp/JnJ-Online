# Director's Page — Redesign Handoff

## Scope

This pass covers the **Combat tab** (Player Characters column, Combat
Tracker column, Enemies column) and the **Skills & Flaws sidebar**.
Explicitly unchanged:

- The Roleplay tab
- The Maps tab (upload UI + map list)

The tab switcher itself (`TabContainer.js` / `TabContainer.scss`) is **not**
part of the problem and needs no changes — it's already fully DarkArcane
themed and matches the character page's mobile tab bar. Only the Combat tab's
content underneath it was clunky.

Design canvas: see the published artifact link shared alongside this doc.
`Before.dc.html` recreates the current look (raw `rgb()` boxes, from the
real `DirectorsPage.scss` values) for side-by-side comparison; `Main.dc.html`
is the redesign, fully interactive (tab switching, card expand/collapse,
AP stars, status add/remove/expire, Line/Map tracker toggle, Add Status
dialog for both players and enemies).

`handoff/reference.html` is a standalone, dependency-free HTML/JS copy of
the same Combat tab interactions, for pixel-checking against the built
result without needing the design canvas.

## What's changing, and why

`DirectorsPage.js` currently renders the Combat tab with three raw-`rgb()`
boxes (`DirectorsPageCharacterStatsOverride` wrapping the **deprecated**
`CharacterPageAbilityScorePanel` / `CharacterPageStatsPanel` for player and
enemy stats, plus a plain gold box for the tracker). None of it uses the
`--jnj-color-*` tokens. The redesign:

1. Replaces the raw-color panels with `.card` styling (`--jnj-color-raised`
   background, `--jnj-color-border`, 14px radius) — same recipe as every
   other themed surface in the app (see `CombatActionList.scss`,
   `TabContainer.scss`).
2. Player and enemy stat blocks are restyled to match **`CharacterPageVitalsPanel.js`**'s
   real visual language (HP bar, AC shield-with-overlay, AP stars) instead
   of the old two-panel components' look — same tokens, same iconography
   (`shield.svg`, filled/empty star SVGs), scaled down to fit a sidebar-width
   card. This does **not** require ripping out
   `CharacterPageAbilityScorePanel`/`CharacterPageStatsPanel`'s underlying
   data logic — only their markup/CSS, the same way `CharacterPageVitalsPanel`
   replaced them on the character page.
3. Action lists reuse `CombatActionList.js`'s real `CombatActionListCard`
   recipe (`bg-sunken` card, name/meta header, description, tag row) rather
   than inventing new action-card styling.
3a. Each player/enemy card is now collapsible (name + HP always visible;
    click to expand vitals/statuses/actions) so a full combat roster doesn't
    force endless scrolling in the side columns.
4. The Combat Tracker column keeps `PostListContentCombatMap` /
   `CombatMap` exactly as they are today (already themed via
   `--jnj-color-*` in `CombatMap.scss`, and `campaigns.{id}.combat_tracker`
   is live-synced by `PostListCombatMap.tsx`) — it's now wrapped in a
   properly themed `.card` container instead of a plain gold box. The
   mockup also adds a **Line View / Map View** toggle: "Line View" is the
   existing zone-list rendering, "Map View" is a placeholder for showing
   entities positioned on the campaign's active map image — flagging this
   as a nice-to-have extension, not a requirement, since it's new surface
   area beyond "reskin what's there."
5. Extends the **Statuses** UI (chips + Add Status dialog, same visual
   pattern as `Statuses.js` / `AddStatusDialog.js` on the character page)
   to both player and enemy cards. `advanceTurnStatuses()` is already wired
   to `DirectorsPage.js`'s "Next Turn" button for players — the redesign's
   `Next Turn` control per-card is that same call, just relocated into the
   restyled card.
6. Surfaces `Weaknesses[]` / `Resistances[]` on enemy cards as chip rows.
   These fields already exist on `NPCLayout.json`'s enemy shape but are
   currently rendered nowhere in the UI — this makes them visible to the
   Director without adding new data.
7. Tab icons (scroll / swords / map) are added to the Director's Page's own
   tab definitions, matching `CharacterMainTab.js`'s existing
   `icon: <ScrollIcon/>` pattern — a small parity fix, not a new component.

## Skills & Flaws sidebar

Good news here: `DirectorsPage.js` already renders the real, already-themed
`SkillsAndFlaws` component for each character's skill/flaw list (line ~128,
`<SkillsAndFlaws isOpen={true} characterPage={actualCharacter}/>`) — the
same component the character page uses, styled correctly today via
`SkillsAndFlaws.scss` (`--jnj-color-*` tokens throughout: `bg-raised` cards,
accent border for skills, danger border for flaws, chevron + name + star
rating trigger, expand for description). **Nothing about that inner
component needs to change.**

What's clunky is only the *outer* chrome this component sits inside:

- `.DirectorsPage-SkillsTab` — flat `rgb(73,73,73)` background, no
  relationship to the theme.
- `.DirectorsPage-player-skill-dropdown` / `-trigger` — the per-character
  section header, currently a plain `rgb(0,0,78)` navy bar with just the
  character's name in white text.

The redesign keeps the per-character grouping (still one collapsible
section per character in `characterList`) but restyles the shell to match
the character page's own sidebar treatment
(`.CharacterPage-skills-and-flaws { background-color: var(--jnj-color-bg-sunken); }`):
a `bg-sunken` panel, a hairline `border-bottom` between characters, and a
themed section header (person icon + character name in `--jnj-font-display`
+ chevron) in place of the navy bar. The real `SkillsAndFlaws` cards
underneath render unchanged — the mockup's skill/flaw cards intentionally
mirror `SkillsAndFlaws.scss`'s exact recipe (border color, radius, chevron,
star icons, expand-for-description) so what you see in the design canvas
*is* what `SkillsAndFlaws.js` already produces, just inside a matching
frame.

Widened from 260px to 280px in the mockup to give the card recipe (tuned
on the character page for a much wider `20vw` column) a little more room
to breathe — worth eyeballing against the real component once it's wired
in and adjusting either the sidebar width or the card's internal spacing
if it still feels tight.

## Statuses on enemies — plumbing gap (flagging, not solving)

`Statuses.js` writes via
`updateDoc(doc(db, "characters", characterPage.character_id), {...})`.
Enemies are NPC objects sourced from `NPCLayout.json`-shaped data — they
are **not** documents in the `characters` collection and have no
`character_id`. Extending Statuses to enemy cards needs either:

- a parallel write path for enemies (e.g. a `directors`/`campaigns`-scoped
  document holding per-encounter enemy state), or
- promoting active encounter enemies into their own Firestore docs when a
  fight starts.

This is a data-model decision for the coding agent, not something this
design pass resolves. The mockup's Add Status dialog is parameterized by
`{kind: 'player'|'enemy', id}` specifically so the same UI can point at
either write path once one exists.

## Pre-existing bug, surfaced during this pass (not caused by it)

`CombatActionList.js`'s "Use Action" button unconditionally does
`updateDoc(doc(db, "characters", characterPage.character_id), ...)`.
`DirectorsPage.js` currently passes `characterPage={actualEnemy}` for the
enemy `CombatActionList` with `canUseActions={true}` — since enemies have
no `characters` collection doc, clicking "Use Action" on an enemy action
today either no-ops or throws. Worth a ticket regardless of this redesign;
the same enemy-statuses plumbing fix above (a real per-encounter enemy
doc) would resolve both issues together.

## Files to touch (real app)

- `DirectorsPage.js` — swap the three raw panels for the new card
  structure; add per-card collapse state; wire the existing
  `advanceTurnStatuses()` call into each card's Next Turn button; add
  `Statuses`/`AddStatusDialog` for players immediately (existing plumbing)
  and for enemies once the write-path above is decided; add tab icons.
  Also restyle `.DirectorsPage-SkillsTab` (sidebar shell) and
  `.DirectorsPage-player-skill-dropdown`/`-trigger` (per-character header)
  per the "Skills & Flaws sidebar" section above; the `<SkillsAndFlaws>`
  call itself (line ~128) is unchanged.
- `DirectorsPage.scss` — replace the `rgb()` block colors
  (`.DirectorsPage-CombatCharacterStats`, `.DirectorsPage-CombatTracker`,
  `.DirectorsPage-CombatEnemyStats`, the green/amber dropdown triggers,
  `.DirectorsPage-SkillsTab`, `.DirectorsPage-player-skill-dropdown`/
  `-trigger`) with `--jnj-color-*` tokens; drop
  `.DirectorsPageCharacterStatsOverride` once the deprecated panels are no
  longer used here.
- No changes needed to `TabContainer.js/scss`, `CombatMap.scss`,
  `PostListCombatMap.tsx`, `Statuses.js`, `AddStatusDialog.js`,
  `SkillsAndFlaws.js/scss`, `CombatActionList.js/scss` — all reused as-is
  (or, for `CombatActionList`, as the *visual reference* for new card
  styling).

## Explicitly out of scope this pass

- Maps tab (`<input type="file">` + `.DirectorsPage-map-item` list)
- Roleplay tab
- `CombatTracker.js` (confirmed dead/unused scaffold — not imported by
  `DirectorsPage.js`; no action needed)
