# Cinematic Skies — R&D Technical Record

**Product:** Weather: Cinematic Skies
**Codebase path:** `src/products/weather-cinematic`
**Prepared:** 2026-08-26, by Engineering
**Purpose:** Technical record of the algorithms, rendering architecture, and performance experimentation behind Cinematic Skies, prepared to support R&D tax credit substantiation.

This document is not a legal or tax opinion. It documents the technical uncertainty the team faced and the process used to resolve it. Final qualification and credit computation — including the "substantially all" (80%) threshold under Treas. Reg. §1.41-4 — are determinations for your tax advisor under IRC §41 and applicable state statutes.

## 1. Summary

Cinematic Skies renders a continuously varying sky, on a per-second basis, for any location and moment in time. The underlying feed data — cloud cover percentage, precipitation type and rate, wind speed and heading, sun/moon position, thunderstorm state — arrives as raw meteorological and astronomical measurements. None of it arrives as an instruction for how to draw anything.

The combination space this has to cover is not enumerable as static assets: 6 times-of-day × 5 cloudiness levels × 4 rain levels × 4 snow levels × 8 wind directions × storm on/off. The engineering work below is the layer that turns raw measurements into a physically plausible, continuously animated scene, in real time, across hardware ranging from desktop browsers down to low-power digital-signage players — from a small base asset library rather than pre-rendered footage per combination.

This record deliberately excludes layout, color choice, and visual polish, and isolates the parts of the build that involved genuine technical uncertainty at the outset — where the team did not know in advance whether a given computational approach would work, and had to build and measure candidate approaches to find out.

## 2. How this maps to the four-part test

**Permitted purpose — the business component test.** Every exhibit below targets the functionality, performance, reliability, or capability of the rendering engine — dropped frames on constrained hardware, correct derivation of real-world state from raw data, and asset-library reuse across conditions the engine hadn't been built to handle before. None concerns aesthetic design, style, taste, seasonal variation, or cosmetic enhancement, which this record deliberately excludes as non-qualifying.

**Elimination of uncertainty.** At the start of each exhibit, the team did not have information readily available confirming the capability of achieving the result, the method needed to achieve it, or the appropriate technical design — whether a shared animation clock, canvas particle fields, timezone-database-free ephemeris math, or SVG-filter color grading would hit target frame rates or produce correct output on the target hardware and data. That uncertainty needn't be new to the industry; it's uncertainty as measured against what this team knew going in.

**Process of experimentation.** Section 4 documents dated internal audits that evaluated and compared multiple candidate approaches — engineering analysis and, in places, direct benchmarking (e.g. the GPU-capability scoring test in `weather-cinematic-animation.md`) — before the team converged on an implementation. This evaluative work, not incidental cleanup, is the substantial majority of what each exhibit describes.

**Technological in nature.** The work is grounded in computer science — real-time scheduling, canvas/GPU compositing, data-structure design — and applied physics/astronomy — celestial positioning, twilight ephemeris, lunar phase geometry. None of it rests on social science, economics, market research, or purely artistic judgment.

## 3. Technical uncertainty and experimentation, by system

### Exhibit A — Single-clock animation scheduler
`Content.vue` (`AnimationManager`)

- **Uncertainty:** Rain, snow, and stars each originally ran an independent `requestAnimationFrame` loop with its own timestep math. It was not known whether those loops could be merged into one shared clock without desynchronizing each layer's physics, or without reintroducing the frame conflicts and GPU thrashing the team had measured on low-power signage hardware.
- **Method:** Built a registrar/dispatcher (`AnimationManager`) that drives a single `requestAnimationFrame` loop and calls each registered layer's `update(currentTime, deltaTime)`. Every layer's integration math was rewritten from wall-clock-relative to injected-`deltaTime`-relative, so correctness no longer depends on which layer's frame lands first. A rolling 60-frame FPS sampler feeds a dev-only meter used to measure the change.
- **Resolution:** Every background layer now registers through Vue's `provide`/`inject` instead of owning its own loop; the FPS instrumentation remains in the shipped code as a standing measurement tool.

### Exhibit B — Ephemeris-derived time-of-day classifier
`state.ts` (`transformTimeOfDay`)

- **Uncertainty:** The scene must select one of six lighting states — Nighttime, SunriseNight, SunriseDay, Daytime, SunsetDay, SunsetNight — from raw civil/nautical twilight and sunrise/sunset timestamps, correct for an arbitrary location's *local* time, on a signage device that may be set to a different timezone or clock entirely. Calendar-day wraparound around midnight is exactly the class of edge case that fails silently until tested against real data across many locations and seasons.
- **Method:** Location-local "now" is computed by adding the feed's numeric UTC offset directly to epoch time, rather than trusting the device's `Intl`/timezone settings — making the calculation deterministic independent of the player's own locale. All twilight boundaries are re-anchored onto sunrise's calendar date via `date-fns.set()` before comparison, collapsing the midnight-wraparound case. The state is then chosen by walking `isBefore()` comparisons against the four twilight boundaries in sequence:

  ```
  morningNautical → morningCivil → sunrise → sunset → eveningCivil → eveningNautical
  isBefore(now, boundary) walked in sequence → one of 6 states
  ```

### Exhibit C — Parametric celestial-body rendering
`Sun.vue`, `Moon.vue`

- **Uncertainty:** Whether the sun and moon could be rendered as continuously data-driven light sources — positioned and phase-shaded live from feed data — instead of a fixed sprite sheet, while staying inside the frame budget on signage GPUs. In-code notes record that full rotation and pulse animation were benchmarked and found too expensive, and pulled back.
- **Method (sun):** Sun position is a normalized parametric value mapped to a screen x-coordinate; the disc itself is composited from primitives — an additive radial-gradient core plus six trig-rotated polygon spikes, one set carrying a sine-modulated angular wobble — rather than an animated image asset.

  ```
  sunX = fromSunrise / (fromSunrise + |fromSunset|)
  spike[i].angle = i · (π / 3) − 0.1·sin(t · 0.1)   for i in 0..5
  ```

- **Method (moon):** Lunar phase (0–1) is mapped to a mirrored radial-gradient shadow offset, approximating a terminator line in 2D without a 3D lighting model — plus a phase- and sky-condition-keyed color table so the shadow reads correctly against both the fair and cloudy sky palettes.

  ```
  shadowOffset = (phase − 0.5) · 2 · radius
  gradientX = invert ? radius + shadowOffset : radius − shadowOffset
  ```

### Exhibit D — Canvas particle systems: dirty-rect clearing, gradient caching, packed buffers
`Rain.vue`, `Snow.vue`, `Stars.vue`, `utils.ts`

- **Uncertainty:** Whether canvas-rendered rain, snow, and star fields — each up to several hundred particles, wind-driven and recomputed every frame — could hit acceptable frame rates on constrained GPUs, given that full-canvas clears and per-frame gradient allocation had been measured as major costs.
- **Method:** `DirtyRectangleTracker` computes only the swept bounding region each particle occupies between the previous and current frame, merges overlapping regions via rectangle union, and clears only that area instead of the full canvas. A coordinate-keyed `GradientCache` memoizes `CanvasGradient` objects so identical gradients aren't rebuilt every frame. Snow's particle system is packed into a single `Float32Array` with a fixed 10-field stride per particle (position, velocity, size, life, swing phase) instead of an array of objects, removing per-frame allocation and the GC pauses that come with it.
- **Resolution:** All three particle layers share this toolkit. Particle counts are further normalized against a fixed 800px baseline (`scale = max(width,height) / 800`) so density — and per-frame cost — stays consistent from a small footer strip up to a 4K display without per-resolution manual tuning.

### Exhibit E — Device-adaptive quality scaling
`usePerformance.ts`

- **Uncertainty:** A single fidelity target could not run uniformly across the hardware spread the product targets — full desktop browsers down to low-power signage players — without either overloading weak devices or under-using capable ones.
- **Method:** A quality-profile table (`none | low | medium | high`) parameterizes cloud-layer count, particle-count multiplier, animation-speed multiplier, and independent toggles for the effects the earlier profiling work had flagged as disproportionately costly (sun pulse, star twinkle, star parallax, card blur). Every particle and animation system reads its counts and speeds from this single profile rather than a hardcoded value local to that component.
- **Resolution:** The render-cost/fidelity tradeoff is one tunable axis, enforced consistently across rain, snow, stars, sun, and clouds from a single source of truth.

### Exhibit F — Procedural per-condition color grading
`Clouds.vue` (`customFilter`, SVG)

- **Uncertainty:** A small library of base cloud photographs needed to read correctly under six times-of-day crossed with up to five cloudiness levels — without shipping a separately graded image per combination, and without paying per-frame canvas pixel-manipulation cost.
- **Method:** An SVG `<filter>` built from `feComponentTransfer` gamma curves — independent amplitude/exponent/offset per RGB channel, table-driven by time-of-day — plus an `feFlood`/`feComposite`/`feBlend` soft-light tint stage re-grades the same base image on the browser's own filter pipeline. `mix-blend-mode: screen` is layered on top so one asset composites correctly against the six different procedurally-generated sky gradients from Exhibit B.
- **Resolution:** One base cloud asset set serves every lighting condition; grading parameters are data, not pre-baked pixels.

### Exhibit G — Fault-tolerant asset preload gate
`preload.ts` (`preloadImage`)

- **Uncertainty:** The render pipeline gates on `Promise.all()` over a variable-length set of image loads. On a signage network link, a single request can fail to ever fire either `onload` or `onerror` — which would hang that `Promise.all()`, and with it the whole intro sequence, indefinitely.
- **Method:** `preloadImage()` is engineered to always settle and never reject: it races each image's load/error events against a fixed per-asset timeout and resolves with a status enum (`loaded | failed | timed-out`) rather than throwing.
- **Resolution:** The render gate has a hard ceiling regardless of how many of the concurrent requests fail; missing assets degrade to "absent from the scene" instead of blocking playback.

## 4. Contemporaneous evidence of alternatives evaluated

The repository retains dated internal audits from the performance work, written before the current architecture was settled on. They record approaches that were considered and, in several cases, explicitly rejected in favor of a simpler or cheaper alternative — which is itself part of the experimentation record.

| File | Status | What it shows |
|---|---|---|
| `weather-cinematic-animation.md` | **Adopted** | Full performance audit identifying the three independent `requestAnimationFrame` loops as the primary bottleneck; proposes the consolidated `AnimationManager` pattern that was subsequently built (Exhibit A). Also proposes gradient caching, dirty-rectangle rendering, and object pooling, each of which shipped in some form (Exhibit D). |
| `weather-cinematic-animation.md` | Evaluated, not adopted | Same document also specs a Web Worker offload for particle physics, a spatial-partitioning grid for star/moon occlusion, and a benchmark-driven device-tier detector (drawing 1,000 gradient circles to score GPU capability). These were assessed but superseded by the simpler adaptive-profile approach in Exhibit E. |
| `cloud-performance.md` | Evaluated, not adopted | Asset-strategy analysis comparing multi-resolution WebP breakpoints, AVIF format, and a pure-CSS cloud fallback against the shipped SVG-filter approach; documents the measured 5–8× oversizing of the original cloud textures relative to target display resolution that motivated the asset-size work. |
| `cloud-performance-2.md` | Evaluated, not adopted | Deeper technical assessment of `Clouds.vue` specifically, comparing CSS-filter compositing against a canvas/WebGL rewrite and mathematical (per-pixel) color adjustment; the SVG `feComponentTransfer` approach in Exhibit F is the point this analysis converged toward. |
| `Content.vue` (`AnimationManager`) | **Adopted** | Shipped implementation of Exhibit A, including the live FPS sampler used to measure the effect of consolidation. |

## 5. Exhibit coverage of the four-part test

| Exhibit | Permitted purpose | Uncertainty | Experimentation | Technological |
|---|---|---|---|---|
| A · Scheduler | ✓ | ✓ | ✓ | ✓ |
| B · Time-of-day | ✓ | ✓ | ✓ | ✓ |
| C · Sun / Moon | ✓ | ✓ | ✓ | ✓ |
| D · Particle systems | ✓ | ✓ | ✓ | ✓ |
| E · Adaptive quality | ✓ | ✓ | ✓ | ✓ |
| F · Color grading | ✓ | ✓ | ✓ | ✓ |
| G · Preload gate | ✓ | ✓ | ✓ | ✓ |
