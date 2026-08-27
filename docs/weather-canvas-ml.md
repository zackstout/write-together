# Weather Canvas improvements

We would like to circle back to this project and try to complete it.

Take a good look over the code and try to point out the most important parts.

Try to understand and summarize the problem being approached.

Then help form a plan for how to proceed.

The project never was completed, because we struggled to find a good way to balance competing concerns: background always looks good, it looks sufficiently different each time, and most importantly, it tangibly feels like it represents the data in some way.

My gut idea for a new path forward, is to try to use machine learning to train a model on a bunch of examples. This would require generating a bunch of random examples and then having humans grade them: first, is this usable? if so, how good is it overall, and how well does it represent different weather dimensions? Please appraise that plan. 

Write your response to this document.

---

## Response

### What the project actually is

The repo is ~25 independently bootstrapped prototypes testing structurally different ways to turn weather data into an ambient background: volumetric god-rays, particle/fluid sims, procedural 3D parallax terrain, and FBO-based painterly diffusion. The winning line is the `watercolors` → `watercolors-6` series — an FBO ping-pong shader ("brushes" diffuse color across a canvas each frame, with paper texture, Voronoi/wavelet/Worley noise for brush-stroke feel, and a separate cloud layer). `watercolors-6` is the current live build (`watercolors-6/src/script.js`, 3,120 lines; `shaders/fbo/fragment.glsl`, 546 lines) and is what `docs/research-review.md` and the README's "Visual Presentation Parameters" section describe.

The unsolved problem is exactly what you said: balancing (1) always looks good, (2) looks different each run, (3) legibly represents the data. Right now (1) and (2) are handled by ~25+ hand-exposed `lil-gui` uniforms (`uFbmFreq`, `uVoronoiScale`, `uFeatheringSpeed`, `uCloudCutoff`, etc.) plus **49 hand-tuned presets** (`watercolors-6/src/script.js:15-1977`) that were discovered by manually poking around the parameter space until something looked good — many already weather-labeled (`Rain1`, `IcyRain`, `SnowDay`, `HotDay (Volcano)`, `LightRain`, `MediumRain`, `SummerRain`, `IcyStorm`, `PurpleRain`...). Constraint (3), the data→visual mapping, is **not implemented at all** — there's no code anywhere that reads weather values and sets uniforms from them. `sampleWeather.js` has real weather-API JSON shapes sitting unused, and the in-code TODO log (`script.js:1979-2103`) is explicit about this being the next unsolved step: *"Or you can wait for the next step, of writing adapter from weather data into those states, somehow."* / *"and obviously reacts to the weather data somehow."* Two mapping ideas are jotted but never built: windspeed → cloud speed, precipitation → featheringSpeed.

So concretely, what's missing to "complete" the project is a function `weatherState -> paramVector`, plus a way to keep that mapping visually pleasing and continuously varied.

### Appraising the ML plan

The instinct is reasonable in principle — using a learned quality/legibility score to guide procedural generation is a real, well-established technique. But I'd push back before committing to it as the *next* step, for three concrete reasons specific to where this project actually is:

**1. Random sampling will mostly waste human grading time.** You have ~25+ continuous parameters. The presets exist precisely because uniform random points in that space mostly look bad — the good regions are narrow ("*idk voronoi is prob ideal for strokes*", "*unsure why ballSize not working*" — this was found by hand, not by search). If you generate examples uniformly at random and have humans grade "is this usable," you'll burn most of your labeling budget on obviously-bad examples and get a very inefficient dataset. If you do this, sample *near* the 49 existing presets (small perturbations / interpolations between them) rather than uniformly across the full space — you'll get far more useful signal per label.

**2. You're actually asking two different questions that need two different experiments.** "Is this usable, and how good overall" is a single aesthetic-quality score — learnable from a moderate dataset of (params or rendered frame) → rating. "How well does it represent different weather dimensions" is a *perceptual encoding/legibility* question — it needs per-dimension probes (e.g., show a human a rendering with no other context and ask them to guess temperature/precipitation/wind, or rate agreement with a specific claim like "this looks windy"), not a single overall grade. Collapsing these into one grading pass will undersupply the harder, more novel signal you actually need.

**3. No model can discover a legible encoding that isn't already in the shader.** This is the important one: if `uCloudCutoff` doesn't currently produce any perceptible change that reads as "cloudier" to a human, no amount of training data will fix that — a model can only learn to *select* among effects the shader already exposes, not invent new legible visual language. The design work of deciding "wind speed should visibly do *this*, temperature should visibly do *that*" (per the two sketched ideas in the TODOs) is manual/creative work that has to happen before or alongside any ML step, not after it.

### Recommended path forward

Before building an ML data-generation + rating pipeline (which is a real infra project: a rating UI, a labeling protocol, a model, a training loop), I'd spend a much cheaper week or two validating the *design* question the ML plan is ultimately trying to answer:

1. **Turn the 49 presets into a lightweight lookup/interpolation mapping first.** Tag a subset of the weather-named presets with the weather dimensions they represent (temp, precip, wind, sky cover), and write an explicit function that blends/lerps between nearby presets based on live weather values, with a bit of controlled per-session jitter for variety. This is buildable directly on what already exists, costs almost nothing next to an ML pipeline, and gives you a working end-to-end demo you can point real weather data at immediately.
2. **User-test *that* for legibility** — show people renderings (blind, no data label) and ask them to guess conditions, exactly the protocol you'd eventually want for ML grading anyway. This tells you two things at once: whether the current shader's parameters are even capable of encoding weather legibly (see point 3 above), and it produces your first real per-dimension-legibility dataset for free, as a side effect.
3. **Only then reach for ML**, and split it as: (a) a cheap "is this combination broken/unusable" filter — near-preset sampling, could plausibly be a small model over parameter vectors rather than images, used to keep procedural jitter inside safe bounds — and (b) if step 2 shows the shader *can* encode dimensions legibly but the hand-authored curves are suboptimal, a model that learns/refines the mapping curves themselves, trained on the per-dimension legibility data from step 2 rather than a fresh random-sampling pass.

This sequencing gets you a shippable v1 sooner, and turns the expensive ML investment from a bet into something informed by real perceptual data.

### How much labeled data would you actually need

Two different data budgets, matching the two experiments in point 3 above. Worth being deliberate about this because it's a small-feature-vector problem (score a ~25-30 dimensional parameter vector, sampled near 49 known-good presets), not an unconstrained image-classification problem — the numbers are much smaller than "ML" intuition usually suggests.

**Usability filter (parameter vector → broken/not-broken).** Train this on the uniform values directly, not on rendered pixels. Classical tabular-ML rule of thumb is ~10-30 labeled examples per input dimension for a simple classifier, so roughly 300-900 as a floor. But near-preset sampling (as recommended above) means most sampled points will be safely "usable" by construction, so the model won't see a real decision boundary unless a meaningful fraction — maybe a third — is deliberately sampled at larger perturbation radii to manufacture failure cases. Practical target: **~1,000-1,500 rated combinations**.

**Overall quality score (e.g. 1-10 rating).** A subtler, noisier target than binary usability — any one person's aesthetic rating is inherently variable, so plan to get each combination graded by ~3-5 different people and average/median rather than trust a single rating. That's roughly 300-500 distinct combos × ~4 raters ≈ **1,200-2,000 total ratings** to get a reasonably calibrated signal, again concentrated near the 49 presets rather than spread uniformly.

**Per-dimension legibility ("does this look windy/rainy/cold/hot").** This is really a psychophysics-style experiment, not a training set — you don't need a trained model to run it, just enough trials to see whether a legible signal exists at all, which is exactly why it's the cheapest and best first step. Rough floor: 4 dimensions (temp, precip, wind, sky cover) × 4-5 levels each × ~20-30 blind guesses per level ≈ **400-600 total judgments**, drawn from a much smaller set of underlying renders (~30-50 images spanning the levels) each shown to multiple people — the thing being measured is human agreement, not model generalization, so distinct renders can be far fewer than distinct judgments.

**Bottom line:** the legibility test (step 2) needs the least data — a few hundred judgments over a few dozen renders — and it's the one that tells you whether the rest is worth building. If it validates, the two downstream models land in the low thousands of labels each, not tens of thousands, because the search space is constrained to variations of 49 already-good presets rather than the full unconstrained parameter space or raw pixels. That's a small internal rating tool and a handful of people doing short rating sessions over a couple of weeks, not a crowdsourcing effort.