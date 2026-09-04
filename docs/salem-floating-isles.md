# Salem Floating Isles

Salem Floating Isles is a public browser mini-game at `/salem`. It is hosted by
the Laravel/Inertia application, but the page opts out of the normal application
chrome so the Three.js scene can fill the viewport.

## Lifecycle

The page receives `initialSave` from `SalemController`. React mounts the HUD,
temporary test controls and `SalemGameCanvas`. The canvas owns a `SalemScene`
instance, which creates the Three.js renderer, camera, lights, island
archipelago and Salem model. The scene exposes a small handle for forcing pet
actions, resetting Salem and changing weather.

The frontend does not calculate canonical rewards. It only reports valid action
events to `/salem/actions`; `SalemProgressionService` applies cooldowns, awards
Cozy Points and returns the updated save.

## Anonymous Persistence

`SalemPlayerIdentityService` creates a UUID visitor key and stores it in the
first-party `salem_visitor` cookie. Laravel encrypts the cookie because it is
not excluded in `bootstrap/app.php`. The database stores the UUID as
`salem_players.visitor_key` and stores an HMAC of the request IP as a nullable
secondary signal. Raw IP addresses are not stored for Salem saves.

## Tables

- `salem_players`: anonymous visitor identity, first seen and last seen times.
- `salem_game_saves`: structured save data, including level, xp, Cozy Points,
  current biome, pet state, small extensible payload and save version.
- `salem_unlocks`: milestone unlocks keyed by type/key for future expansion.

All three tables are created by a reversible migration.

## Frontend Structure

- `resources/js/pages/salem/index.tsx`: Inertia page composition.
- `resources/js/features/salem/components`: HUD, canvas wrapper and temporary
  dev controls.
- `resources/js/features/salem/game/scene`: Three.js scene lifecycle and
  rendering.
- `resources/js/features/salem/state`: action sequence and autonomous behavior
  logic.
- `resources/js/features/salem/world`: island, navigation and prop
  configuration.
- `resources/js/features/salem/environment`: weather presets.
- `resources/js/features/salem/api`: focused API client.

## Adding Content

Add an island by extending `islandConfigs` with a unique id, biome, position,
radius, terrain colors, props and optional waterfalls. Add a biome by extending
the `IslandBiome` type and adding biome-specific colors in the scene helpers.
Add an action by extending the `SalemAction` type, `salemActionSequences`,
backend validation and `SalemProgressionService` rules.

External assets must be placed under `public/assets/salem/`, optimized for the
web, and documented in `docs/salem-assets.md` before use.

## Dev Controls

The collapsible `DEV / TEST CONTROLS` panel can force Idle, Walk, Sit, Sleep,
Program and Inspect, reset Salem's position, add a server-calculated Cozy Points
bonus and switch weather presets. It is isolated in
`SalemDevControls.tsx` so it can be removed later without touching core
gameplay.

## MVP Limits

The first version keeps Salem on the main island and uses lightweight waypoint
motion instead of a navmesh. Most environmental assets are procedural Three.js
geometry. The external cat model has a procedural fallback so the route degrades
instead of rendering a blank canvas if the asset fails to load.
