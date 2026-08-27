# Do we need quicker/reactive data updates?

Short answer: no — and the codebase's own recent history already argues the
opposite direction.

## The transport ceiling makes "quick" mostly moot

Data arrives via HTTP poll, not push. `dataRefresh` floors at 20s
(`appState.ts`), and typical products sit at 20s–15min: flight-status-board
2min, weather-maps 2min, power-bi 15min. Rotation dwell is ~7–10s per view.
"Quicker" application at the render layer can't beat staleness that's already
baked in by the poll interval — actually buying real-time-ness would require
websockets/SSE, a much bigger change than anything at the render layer.

## The actual direction of travel here is the opposite of "quicker"

`src/rotation/stagedFeed.ts`'s own docstring says 13 of 20 products apply new
data *immediately*, mid-rotation, today — and that's treated as a bug:
entrance animations replay from black, the dwell timer restarts, keyed
components remount. The A1/A2/A3 PRs (trending-graphics, weather-maps,
community-calendar) are a deliberate rollout that converts immediate-apply
products to boundary-staged apply — new data is staged and applied at the next
rotation boundary instead of interrupting the item on screen.

Grep confirms the not-yet-converted products still write `model.value = feed`
directly inside `onDataUpdated`, i.e. they still have the mid-item jank bug,
not a jank-free "quick update" feature:

- sports-central
- financial-graphics
- local-traffic
- power-bi
- tiktok
- healthy-bites
- local-favorites
- window-to-our-world
- health-graphics

Already converted / correctly staged: community-calendar, trending-graphics,
weather-maps, flight-status-board, news-graphics, social-apps.

Single-view products (e.g. calendar, traffic-maps) apply immediately by
design via `stagedFeed`'s `immediate: true` mode — there's no "mid-item" to
protect, so freshness is the point there.

## Even the time-sensitive-sounding domains don't change the calculus

Sports scores and financial movers feel live, but they're polled at the same
cadence as everything else, games/markets run for hours, and a rotation cycle
is under a minute. Waiting for the next boundary costs nothing perceptible
while buying a non-janky transition.

## The one real exception already in the code

flight-status-board stages too, but a single-page board has no "mid-item" to
protect, so it does a `watchOnce` on the staged ref to wake and apply
immediately when no rotation is in flight. That's the actual rule worth
generalizing — **apply immediately when nothing is currently mid-transition,
stage otherwise** — not "make updates quicker" as a global goal.

## Recommendation

Don't invest in a "fast/reactive updates" initiative. Instead:

1. Finish the staging rollout (A4+) for the remaining 9 products listed above.
2. Where a product can be in a genuinely idle state between rotations, reuse
   flight-status-board's wake-on-stage pattern rather than building anything
   new.
