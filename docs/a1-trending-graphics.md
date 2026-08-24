# Code Review — `a1-trending-graphics`

Branch converts trending-graphics to the shared rotation surface (`registerRotation`,
`useTimer`, `createStagedFeed`). The rotation and staged-feed work is solid. Three
concerns below.

---

## 1. Empty `pause()` and `resume()` may not cover CSS animations

```ts
// Content.vue
pause: () => {},
resume: () => {},
```

`registerRotation` stops the timer group and GSAP's global timeline before it calls
`pause()`. That covers any GSAP tweens and the rotation timer. The no-op body is
correct **only if** `TrendSlide` and `TrendFlip` use GSAP (covered by the global
timeline), or their CSS transitions are short enough that continuing through a host
pause is harmless.

If either component uses a CSS `animation` or a `requestAnimationFrame` loop that
runs longer than a frame or two, a host pause will not stop it. Worth a quick check
of those components before merge.

---

## 2. Module-level `stagedFeed` is re-assigned on every `initialize()` call

```ts
// state.ts
let stagedFeed: StagedFeed<TrendingGraphicsFeed> | undefined;

export const initialize = async (...) => {
  const staged = createStagedFeed(...);
  stagedFeed = staged;           // replaces the previous reference

  const onDataUpdated = (feed) => {
    staged.stage(feed);          // closes over the old `staged`, not the module var
  };
```

In production `initialize()` is called once, so this does not matter. In tests, if
`initialize()` is called twice the second call replaces `stagedFeed` with a fresh
object — but the `onDataUpdated` from the first call still has a closure over the
first `staged`. Any refresh fired through that old handler stages into a buffer that
`applyStagedFeed()` no longer points at, silently dropping the data.

The staged-feed test file mocks `initializeAppState` and calls `initialize()` once
per test, so nothing currently breaks. But it is a quiet trap for a future test that
calls `initialize()` twice.

---

## 3. `applyStagedFeed()` in the single-page path triggers a `numberPages` recompute before the cursor is snapped

```ts
// Content.vue — the numberPages <= 1 path
applyStagedFeed(); // model.value changes → numberPages recomputes immediately
if (pageIndex.value > 0) {
  pageIndex.value = 0;
}
scheduleNext();
```

If the incoming feed grows the page count above 1, `numberPages` is already > 1 by
the time the cursor snap and `scheduleNext()` run. No crash and no stall — the next
tick of `next()` takes the normal multi-page path. But the product stays on page 0
for a full duration even if the new feed has content on other pages. That is probably
the right behavior for a board that just received new data, but it is an implicit
consequence of the ordering rather than a stated decision.

---

## Minor notes

- The `setIndex` wrap formula `((target % pages) + pages) % pages` correctly handles
  negative host-supplied indices.
- The `afterEach` blocks intentionally avoid `eventBus.off("play")` (bare form) to
  protect `appState`'s own handler. The comments explain this clearly, which matters
  because it looks like something a future editor would "fix."
- The `startPlayback` helper in `rotation.test.ts` advances 2000 ms to let the play
  gate latch. That timing is coupled to `appState`'s intro behavior, so if the play
  gate delay changes, the tests would silently start testing the wrong thing.
