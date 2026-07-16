# HANDLING - conversion roadmap from the SPIRE strip

This tree is SPIRE stripped to the keep-list. It **does not compile yet.** The path to a
green build and then a working Summoner Game is below, grouped and ordered.

See the design doc for the *why* behind every target state. This file is the *what to do*.

---

## What was removed outright

Pure tower/faction UI with no keep-list value, plus dead test harness:

- `screens/StationScreen.tsx` - the tower grid hub (its patterns get cannibalized into the new Location view, but the file is gone)
- `components/ModuleCard.tsx`, `screens/ModuleDetailScreen.tsx` - room UI
- `components/FactionCard.tsx`, `screens/FactionDetailScreen.tsx` - faction UI
- `components/ActorCarousel.tsx` - the reserve-of-5 carousel (replaced by a one-card gacha component)
- `TestRunner.tsx`, `assets/test-init.json`, `public/characters/susan.yaml` - test/sample scaffolding

## What is condemned but still present

`Module.tsx` and `factions/Faction.tsx` were **kept**, but only because the keep-list still
imports types and constants from them (`StationStat`, `Module`, `MODULE_TEMPLATES`, `Faction`,
etc.). They are **not** part of the game and must be deleted once their consumers (Category C)
are converted. Do not build on them.

---

## Category A - dangling imports to clear (mechanical, do first)

These are broken imports left by the removals. Clearing them + stubbing the home route gets
the build most of the way to green.

1. **`App.tsx`** - remove `import {TestStageRunner} from "./TestRunner"` and its usage.
2. **`screens/BaseScreen.tsx`** - remove the `StationScreen` import and the routing case that
   renders it. The default in-game screen slot it occupied is where the new **Home / Location
   view** will go; temporarily route to `MenuScreen` or a stub so the app boots.
3. **`screens/ContentManagementScreen.tsx`** - remove the `FactionDetailScreen` and
   `ModuleDetailScreen` imports and the tabs/sections that use them.
4. **`screens/AttenuationScreen.tsx`, `screens/CryoScreen.tsx`, `screens/EchoScreen.tsx`** -
   remove the `ActorCarousel` import. Each needs the new **single-card component** (Category D)
   to render candidates; until then these three won't list characters.

## Category B - config & deploy (do before first push)

1. **GitHub secret `CHUB_AUTH_TOKEN`** must be set on the new repo - `deploy.yml` hard-fails
   without it. (Optionally `STAGE_ID`, but the workflow will mint one.)
2. **`chub_meta.yaml`** - `extension_id` was intentionally removed so first push creates a
   fresh Chub extension and writes the new id back. `github_path` is already set to
   `Hawkerra/The-Summoner-Game`. Do **not** paste the old SPIRE `extension_id` in.
3. **`public/scenario.yaml`** - still the SPIRE scenario; rewrite for the Summoner Game intro.
4. **`state_schema`** in `chub_meta.yaml` still carries the SPIRE-era `grid` field; revise once
   new state (locations, void, SP) is settled.

## Category C - the big conversions (entangled keep-list files)

Ordered heaviest-first. These are surgery on files we keep.

1. **`Skit.ts`** - the single heaviest item (~375 tower references). Three distinct jobs:
   - **Outcome types:** the effect union mixes actor-scoped effects to KEEP (`actorStat`,
     `roleChange`, `movement`, `newOutfit`, `newActor`) with tower/faction effects to CUT
     (`stationStat`, `factionChange`, `factionReputation`, `newModule`, `towerActivity`).
   - **Scene location:** `moduleId` (where a skit happens) → remap to `locationId` against the
     new Location system. This is a clean conceptual rename, not a deletion.
   - **Prompt injection:** blocks that feed tower state into skit generation ("take on a role
     around the tower", "add a missing room", station-stat-high/low events) → rewrite for
     locations + SP + the Game Master, or cut.
2. **`screens/SkitOutcomeDisplay.tsx`** (~107 refs) - renders the outcome types above. Drop the
   tower/faction branches, keep the actor branches, redirect reward display to **SP**.
3. **`Stage.tsx`** - the orchestrator. Remove Faction/Module/tower-stat/grid state and imports;
   add SP, the location graph, void + active-slot, and recovery-timer state. This is the spine
   rewrite - do it alongside the new systems (Category D), not before.
4. **`SaveRehydration.ts`** (~11 refs) - stop rehydrating Module/Faction on load; add
   rehydration for the new state.
5. **`screens/ContentManagementScreen.tsx`** (~79 refs) - prune the faction/module content
   categories (beyond the import removal in A.3).
6. **`screens/ActorDetailScreen.tsx`** (~47 refs) - reskin the actor sheet from role/module
   placement to void/active status, and make it the entry point to the SP upgrade panel.

## Category D - new systems (from-scratch; see design doc build order)

- **Location graph + dropdown nav** - replaces StationScreen. Home as root, lazy backgrounds,
  skit-birthed sub-locations, 10-turn archiving.
- **Single-card gacha component** - replaces ActorCarousel; one card at a time, derived stars.
- **SP economy + upgrade shop** - stat/skill/ability purchases; new summons; optional 2-active upgrade.
- **Archetype NPC registry** - two-tier extra/named model, portrait cache, promotion path.
- **Game Master event loop** - events on the Skit engine, Summoner-targeting, defeat-as-withdrawal.
- **Void / active-slot logic** - single active summon, rank-scaled recovery timers (reuses Cryo).

## Category E - planned edits to kept files that are *build*, not *strip*

Already-scheduled design work living inside kept files, tracked so it isn't missed:

- **`Actor.tsx`** - swap the 10-rank scale for the 13-rank F-SSS scale; split capability
  (Brawn/Skill/Nerve/Wits/Charm, 13-rank) from bond meters (Lust/Joy/Trust, separate scale);
  add the **derived** star rating; retune the distillation prompt with anchored exemplars.

---

## Suggested order of operations

1. **Category B** (config) - so pushes deploy at all.
2. **Category A** (danglers) + stub the home route - get the app to boot.
3. Then interleave **C** (conversions) with **D** (new builds) following the design doc's build
   order: rank system -> summoning -> locations -> void/slots -> NPCs -> SP shop -> events.

Reaching a *compiling* build is quick (A+B+stubs). Reaching a *functional* build requires C+D,
because you can't simply delete the tower reward paths without the SP path that replaces them.
