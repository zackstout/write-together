# Weather Canvas Product

The idea for this product is to display a unique animated `webgl` canvas, whose parameters are controlled by incoming weather data.

The animation and display is driven entire by a fragment shader, written with `glsl`.

The interesting and difficult part of the project is to balance among a few constraints:

- The view looks good (aesthetically pleasing to humans) given any data input.
- The view is sufficiently random or different each time -- disturbed across parameter space.
- The view responds in a tangible-feeling way to the data input:
  - its visual language encodes various changes in weather, like temperature, air quality, etc.
  - it represents aspects of the data in a tangible way.
- The view should be able to respond to data in a context-agnostic way: weather data should be replaceable with various kinds of data feeds, for instance an immediate feedback view that responded to video input from people viewing the screen displaying the content.

## Permitted purpose

This project intends to develop a new software component for Screenfeed: a real-time, data-driven WebGL rendering system ("Weather Canvas") that translates live weather-condition data into a continuously animated, procedurally generated visual scene. This is a new capability, not a variation of an existing Screenfeed product — prior digital-signage output was not built on a generalized procedural-graphics engine.

The R&D goal is to improve functionality, performance, and reliability of this component specifically:

- **Functionality**: build a shader parameter space broad enough to represent the full range of real-world weather conditions (temperature, wind, precipitation, cloud cover, air quality, etc. — see `WEATHER_NOTES.md`) as visually distinct, legible states.
- **Performance**: achieve this within the constraints of GPU-bound browsers running continuously on signage hardware (an explicit concern in the code: "Worried about performance effects of multiple FBO ping pongs running…", `watercolors-6/src/script.js:1997`).
- **Reliability/quality**: arrive at a stable, generalizable data→visual mapping technique, rather than a one-off hand-tuned animation, so the same rendering system can later be driven by other real-time data feeds (README: "The view should be able to respond to data in a context-agnostic way ... weather data should be replaceable with various kinds of data feeds").

This is distinct from the excluded category of purely aesthetic/style work: the extensive visual experimentation recorded here (color, brush shape, noise algorithm) is in service of discovering a generalized rendering *technique* capable of ingesting arbitrary structured data, which is the underlying software component being developed — not a one-time cosmetic design pass.

## Elimination of uncertainty

At the project's outset (commits begin 2024-12-30), Screenfeed did not know:

- **Whether a single, generalized shader-driven scene could represent the full space of weather conditions coherently.** It was not known whether a data→visual mapping broad enough to stay "aesthetically pleasing" and "tangible" across every combination of inputs was achievable at all, or whether it would instead require many discrete, hand-authored scenes (which would defeat the goal of a generalized, data-agnostic engine).
- **Which underlying rendering technique could satisfy the competing constraints simultaneously** (aesthetically pleasing + sufficiently varied/random + tangibly data-responsive + context-agnostic, per the constraints listed in this document's introduction). This uncertainty is directly evidenced by the ~25 independently bootstrapped experimental sub-projects in this repo, each testing a structurally different approach: volumetric god-rays (`god-rays`, `god-rays-ambient`, `god-rays-streetlamp`), particle/fluid simulation (`water-currents`, `water-waves`, `water-drops`, `water-sand`, `old-water`, `old-wind`, `rainfall`), procedural 3D terrain/parallax (`mountains`, `mountains_2`, `forest-snowy-view`, `streetlamp-snowfall`, `seaside-beach`), and FBO-based painterly diffusion (`watercolors` through `watercolors-6`, `watercolors-yuri`, culminating in `weather-canvas-1`).
- **Whether GPU-resident ping-pong buffer techniques could perform acceptably in a continuously-running kiosk context** — flagged explicitly as an open technical risk in-code rather than assumed.
- **How individual shader parameters would actually behave**, which was not derivable analytically and had to be discovered empirically. Multiple in-code notes record parameters that did not behave as expected and required debugging: "unsure why ballSize not working" and "removal of previous balls still not working quite as I would expect" (`watercolors-6/src/script.js:2097`, `2100`).

This uncertainty only needs to be uncertainty to Screenfeed itself — the company had no prior generalized, data-driven procedural-graphics engine, so the appropriate technical design was not known in advance even though individual graphics techniques exist elsewhere in the creative-coding community.

## Process of experimentation

The repository is itself a record of systematic trial-and-error evaluation of alternatives, not a single planned implementation:

- **25+ parallel/successive prototypes** testing fundamentally different rendering strategies were built and deployed before converging on the FBO/watercolor-diffusion approach — directly mirroring the three competing design hypotheses laid out in the README ("Abstract & Ambient Colored Background," "Cinematic Skies," "Lay of the Land").
- **Six-plus successive numbered iterations** within the winning line (`watercolors`, `-2` through `-6`, `watercolors-yuri`, `weather-canvas-1`), each testing a new noise algorithm (Voronoi vs. Worley vs. wavelet), diffusion technique, or parameter set against the last.
- `watercolors-6/src/script.js:1980-2105` contains an explicit, running engineering log of hypotheses and results — e.g. testing whether Voronoi noise would improve "brushstrokes" ("idk voronoi is prob ideal for strokes.. woowwwww ok it's pretty sick"), evaluating multi-layer FBO compositing for clouds, and comparing color-space parameterizations (hue vs. saturation vs. brightness).
- A live-tunable GUI (`lil-gui`) exposing 25+ shader uniforms (documented in `README.md`'s "Visual Presentation Parameters" section — `uFbmFreq`, `uVoronoiScale`, `uFeatheringSpeed`, `uCloudCutoff`, etc.) was built specifically as an experimentation instrument, with a saved-preset system to capture favorable regions of the parameter space once located by trial.
- Iteration is continuous and dated across roughly six weeks of commits (2024-12-30 through 2025-02-11): "Fade out etc working" → "More progress on 3rd demo" → "Added presets and we are rolling" → "Solid progress on third demo" → "More exploratory work on animated demo" → "Clean up gui and add documentation."
- Substantially all of the recorded activity in this repository is this build-evaluate-refine cycle across shader/rendering approaches; there is no significant body of non-experimental work (business planning, marketing, UX copywriting) diluting that ratio.

## Technological in nature

The work is grounded in computer science and computer graphics, not design taste or market research:

- **GPU shader programming** in GLSL (vertex and fragment shaders), documented in `WEBGL_NOTES.md`, including model-view-projection transforms, normal mapping, and procedural pattern generation.
- **Framebuffer object (FBO) ping-pong buffering** for GPU-resident iterative computation (`watercolors-6/src/shaders/fbo/`) — a standard GPGPU technique for stateful, frame-over-frame simulation without CPU round-trips, used here to drive the watercolor diffusion effect.
- **Procedural noise algorithms** (Voronoi, Worley, wavelet, and classic/simplex Perlin noise — `shaders/includes/perlinClassic3d.glsl`, `simplexNoise3d.glsl`) and signed-distance-field-style shape functions.
- **Real-time rendering pipeline architecture** built on Three.js as a WebGL abstraction layer, including custom post-processing passes (`shaders/post/`) and lighting models (`ambientLight.glsl`, `directionalLight.glsl`, `pointLight.glsl`).
- **Data-driven system design**: architecting a shader-uniform interface intended to be driven by structured external data (weather API JSON, prototyped in `sampleWeather.js`/`sampleWeather.html`) rather than hard-coded constants — a generalized input-mapping problem in software architecture, not merely a rendering problem.

The engineering questions under investigation — which algorithm, which data structure, which numerical parameterization achieves the required functional behavior — are technological questions answered through implementation and testing, not questions of style, economics, or human preference research.



===============

## What must be answered

### Permitted Purpose (The Business Component Test)
The activity must intend to develop a new or improved business component. A business component is defined as a product, manufacturing process, software, technique, formula, or invention. [1, 2, 3, 4]
• The Goal: The research must explicitly aim to enhance the functionality, performance, reliability, or quality of that component.
• Exclusions: Work focused solely on aesthetic design, style, taste, seasonal changes, or cosmetic enhancements does not qualify. [1, 2, 3]

### Elimination of Uncertainty
At the outset of the project, the organization must have faced technological uncertainty regarding the development or improvement of the business component. [1]
• The Goal: The company must show that information was not readily available to confirm the capability of achieving the result, the method required to achieve it, or the appropriate technical design. [1, 2]
• Note: The information does not have to be new to the industry—it only has to be new or uncertain to your specific business. Unsuccessful or failed projects can still qualify if the technical uncertainty was genuine. [1, 2, 3]

### Process of Experimentation
The company must actively evaluate alternative solutions to overcome the identified technical uncertainty. [1, 2]
• The Goal: The taxpayer must demonstrate a systematic trial-and-error approach, simulation, modeling, or engineering analysis.
• The "Substantially All" Rule: Under Treasury Regulations, "substantially all" (interpreted by the IRS as 80% or more) of the project's activities must relate to this process of physical experimentation. [1, 2, 3, 4]

### Technological in Nature
The research and development process must fundamentally rely on principles of the hard sciences. [1, 2]
• The Goal: The activity must be grounded in disciplines like engineering, physics, chemistry, biology, or computer science.
• Exclusions: Activities based on social sciences, economics, arts, humanities, or standard market research are explicitly barred. [1, 2, 3, 4]