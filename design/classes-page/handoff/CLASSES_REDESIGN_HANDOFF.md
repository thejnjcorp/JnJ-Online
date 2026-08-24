# Classes Redesign + Campaign Subscription Handoff

## Scope

Two deliverables, published together in one design canvas:

1. **Classes catalog page** (`Main.dc.html`) — replaces `ClassListPage.js`'s
   current "every class in the database, no filtering, no visibility model"
   view with a themed grid, type + visibility filters, and a per-card
   "Add to Campaign" quick-subscribe action.
2. **Manage Campaign Classes** (`CampaignClasses.dc.html`) — a brand new
   director-facing screen. Nothing like it exists today; the closest
   precedent (`StatusPage.js`'s inline per-status subscribe chips) is a
   weaker pattern this intentionally improves on rather than copies.

`Before.dc.html` recreates today's actual `ClassListPage.js` (verified
against the real file — hardcoded cyan cards, `rgba(161,244,255,0.541)`
background, 36px class names, no design tokens) for side-by-side contrast.

Out of scope this pass: `ClassPage.js`, the 674-line class create/edit
form. It's large enough to be its own design pass, and this handoff only
asks it to gain a handful of new fields (below) — restyling its dozens of
stat/action inputs is a separate task.

## The real gap this closes

Confirmed by reading the actual code (`ClassListPage.js`, `ClassPage.js`,
`NewCharacterPage.js`): **classes have no visibility model at all today.**
`ClassListPage.js` runs an unscoped `getDocs(collection(db, "classes"))` —
every class ever created, from every campaign's homebrew to test/junk
docs, is shown to every viewer, with only a `class_type` filter (no
public/pool/private, no admin-default, no per-campaign scoping).
`NewCharacterPage.js`'s class `<select>` does the exact same unscoped
fetch — a character in any campaign can currently pick literally any
class in the database.

Statuses solved this exact problem already
(`campaigns.subscribedStatusIds`, `ADMIN_UIDS`-gated `isDefault`, a
`public`/`canRead`/`canWrite` triad on each status doc, consumed by
`AddStatusDialog.js`'s scoping filter). This design carries that same
three-tier model over to classes:

- **Default** — admin-curated (`ADMIN_UIDS`-gated, mirrors
  `statusEffects.js`'s existing constant), automatically available to
  every campaign, can't be unsubscribed.
- **Pool** — public submissions anyone can browse; a campaign must
  explicitly subscribe before its characters can pick one.
- **Private** — visible only to its author (or an explicit `canRead`
  list), same as a private status.

## New Firestore fields needed (real data model changes)

On `classes/{id}` — add, parallel to `statuses/{id}`'s existing shape:
```
public: boolean          // true for Default and Pool, false for Private
isDefault: boolean        // true only when set by an ADMIN_UIDS account
canRead: [uid]            // explicit share list for Private classes
// canWrite already exists (though see the bug note below)
```
No `campaignId`-lock field is proposed for classes the way statuses have
one (a status can be authored scoped to a single campaign from the
start) — nothing in the current class-creation flow suggests that's a
requested capability yet; add it later if it comes up, following the
identical pattern statuses already use.

On `campaigns/{id}` — add:
```
subscribedClassIds: [classId]   // exactly parallel to subscribedStatusIds
```

## Screen 1 — Classes catalog (`Main.dc.html`)

- Grid of cards (`bg-raised`, left border colored by `class_type` —
  arcane/ember/success/danger cycling through the four real type values
  from `ClassListPage.js`'s existing filter set: Attrionist, Crit Hunter,
  Manipulator, Snowballer), each showing name, author, type, a
  clamped description, a "View Class" link (→ `ClassPage.js` in read
  mode — see note below), and for Default/Pool cards, an "Add to
  Campaign" button.
- Visibility badge per card (solid gold "Default", outlined violet
  "Pool", outlined faint "Private") — makes the new three-tier model
  visible at a glance, which is impossible today since the concept
  doesn't exist.
- Type filter pills (the same 5 values `ClassListPage.js` already filters
  by) + a new visibility filter row (All/Default/Pool/Private).
- "Add to Campaign" opens an inline popover listing the campaigns the
  viewer directs (`canWrite.includes(userId) || director_uid === userId`
  — same `myWritableCampaigns` computation `StatusPage.js` already does),
  each as a toggle chip. Clicking one does the exact same
  `updateDoc(doc(db,"campaigns",id), {subscribedClassIds: arrayUnion/arrayRemove(classId)})`
  call `StatusPage.js`'s `toggleSubscription()` already demonstrates for
  statuses — same function, new field name.
- "View Class" note: `ClassPage.js` today has no read-only mode — it's
  edit-form-only. Either add a lightweight read-only detail view (own
  route or a query param) or, short term, point "View Class" at the
  existing edit form when the viewer has `canWrite`, and skip the link
  (or show a simple summary card) otherwise. Not resolved by this design
  pass — flagging it since the mockup's "View Class" button doesn't have
  a real destination to link to yet.

## Screen 2 — Manage Campaign Classes (`CampaignClasses.dc.html`)

New screen; no existing route. Three stacked sections for the active
campaign (a campaign switcher pill row sits in the header for directors
of more than one):

1. **Default Classes** — read-only chips, "Included" badge, no action
   (can't be removed — matches how `isDefault` statuses work today).
2. **Subscribed Pool Classes** — cards for everything currently in
   `subscribedClassIds`, each with a "Remove from campaign" button
   (`arrayRemove`).
3. **Browse Pool Classes** — everything public-but-not-yet-subscribed,
   filterable by type, each with an "+ Add to Campaign" button
   (`arrayUnion`). Classes move between sections 2 and 3 live as you
   subscribe/unsubscribe — no separate confirm step, matching the app's
   existing instant-write pattern for chip toggles elsewhere
   (`Statuses.js`, `SkillsAndFlaws.js`).

**Where this lives**: proposed as its own route (e.g.
`/campaigns/:id/classes`), parallel to how `/classes/*` and
`/statuses/*` already work, rather than a tab bolted onto
`DirectorsPage.js`. `DirectorsPage.js`'s Combat tab redesign was just
finished and signed off last pass — inserting a 5th surface into that
tab bar wasn't asked for and this workflow reads fine as its own
destination reached from `CampaignPage.js` (not in scope to redesign
here, just needs a link added). If a tab inside `DirectorsPage.js` is
preferred instead, the content here drops in without change — only the
page chrome (header/breadcrumb) around it would need to go.

Write-gating for this whole screen: same permission check
`DirectorsPage.js` already uses everywhere else
(`userId === campaign.director_uid || campaign.canWrite?.includes(userId)`)
— a director without write access sees the same three sections read-only,
no Add/Remove buttons, consistent with how the rest of the Director's
Page already degrades for read-only viewers.

## Consuming the subscription (character creation)

`NewCharacterPage.js`'s class `<select>` needs the same scoping
`AddStatusDialog.js` already does for statuses — fetch
`campaign.subscribedClassIds`, then filter the classes query to
`status.isDefault || classDoc.canWrite?.includes(userId) || subscribedClassIds.includes(classDoc.id)`
(swap "status" for "class" in that existing filter's shape). Not
mocked up separately since it's a one-line query change to an existing
dropdown, not a new screen — flagging it here so it isn't missed, since
without it the two new screens above look right but a character creator
would still see every class in the database regardless of subscription.

## Pre-existing issues surfaced while reading the real code (not caused by this pass)

- `ClassPage.js` saves `canWrite: [auth.currentUser.uid]` unconditionally
  on every submit — any prior co-author is silently dropped. Identical
  behavior exists in `StatusPage.js`, so this may be deliberate
  single-author semantics rather than a bug — but a subscription model
  implies multi-party interest in the same class doc, so worth a
  deliberate decision (not just inherited behavior) before this ships.
- `ClassPage.js` imports `ClassLayout from '../ClassLayout.json'` for
  form placeholders; that file doesn't appear to exist in the repo as
  checked — worth confirming it's actually present before touching
  `ClassPage.js` for the visibility-field additions above.

## Files to touch (real app)

- `ClassListPage.js` / `ClassListPage.scss` — replace with the new
  catalog grid; scope the Firestore query the same way
  `StatusListPage.js` already scopes statuses
  (`or(where('public','==',true), where('canRead','array-contains',uid), where('canWrite','array-contains',uid))`).
- `ClassPage.js` — add `public`/`isDefault`/`canRead` fields to the save
  payload (visibility radio group, same as `StatusPage.js`'s
  `getVisibilityOptions(isAdmin)` pattern); no visual redesign of the
  form itself this pass.
- New file for the Manage Campaign Classes screen + route + a link into
  it from `CampaignPage.js`.
- `NewCharacterPage.js` — scope the class `<select>` query per
  "Consuming the subscription" above.
- No changes needed to `StatusPage.js`, `StatusListPage.js`,
  `AddStatusDialog.js`, `statusEffects.js` — referenced only as the
  pattern to mirror.

## Explicitly out of scope this pass

- `ClassPage.js`'s full create/edit form redesign (stat inputs, actions
  editor, dice pickers) — only the new visibility fields are proposed.
- A read-only "View Class" detail page — flagged above as needed, not
  designed.
- Any change to `DirectorsPage.js`'s existing tab set.
