# The Summoner Game

A narrative Chub Stage. The player finds a strange gacha app on their phone - but it
summons *real people* into the real world, bound to the summoner as part of a game run
by a hidden Game Master. Slice-of-life at Home, fast dangerous events out in the world,
simulated stakes with no true game-over.

**Status:** Baseline strip in progress. This tree is cannibalized from SPIRE
(itself a fantasy reskin of Lord Raven's PARC), stripped to the keep-list, and is being
converted system by system. It does **not** compile yet - see `HANDLING.md` for the
exact list of what needs handling to reach a green build, and the design doc for the
full spec.

## Layout
- `src/actors/` - Actor model, stats, distillation (the summon pipeline), images, emotions
- `src/screens/` - UI screens (Echo = summoning, Cryo = the void, Skit = the RP loop)
- `src/Skit.ts` - the core roleplay/context-scoping engine
- `HANDLING.md` - conversion roadmap from this strip to a working Summoner Game
