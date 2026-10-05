# Game data dashboard backend

The protected game catalog lives under `/dashboard/game-data` and requires an
authenticated, verified administrator with the `managePortfolio` ability.
The first usable interface is available at `/dashboard/game-planner`; it uses
the same protected JSON endpoints and never duplicates planner logic in React.

## Routes

- `GET /dashboard/game-data`: games, mods and aggregate counts.
- `GET /dashboard/game-data/items`: paginated item search.
- `GET /dashboard/game-data/items/{globalId}`: item details, stats, properties,
  categories, classes, tags, progression, recipes, drops and relationships.
- `GET /dashboard/game-data/recipes`: recipes, optionally filtered by item.
- `GET /dashboard/game-data/npcs`: paginated NPC search.
- `GET /dashboard/game-data/npcs/{globalId}`: NPC details and drops.
- `GET /dashboard/game-data/classes`: supported classes and subclasses.
- `GET /dashboard/game-data/classes/{archetypeKey}/items`: candidate items for a class.
- `GET /dashboard/game-data/progression`: generated progression tracks and milestones.
- `GET /dashboard/game-data/planners`: generated planner summaries.
- `GET /dashboard/game-data/planners/{plannerKey}`: complete generated timeline.

The backend uses `GAME_DATA_DB_CONNECTION`, defaulting to the main application
connection. It can move to a dedicated database without changing routes.

The dataset is generated offline and imported from
`terraria_dataset_mariadb.sql`; normal web requests never fetch Wiki/GitHub data.

## Item icons

Icon binaries live on the configured Laravel filesystem disk (normally
`storage/app/public/game-data/items`). The database stores only the item link,
path, dimensions, byte size, SHA-256, source and source revision. This keeps the
catalog database small while retaining traceability and duplicate detection.

Calamity icons are read from an official `CalamityModPublic` checkout. Vanilla
Terraria icons are resolved through the official Terraria Wiki API:

```shell
php artisan storage:link
php artisan game-data:import-icons --mod=calamity --calamity-repository=/path/to/CalamityModPublic
php artisan game-data:import-icons --mod=terraria
php artisan game-data:repair-icon-metadata
```

The importer is idempotent: ready files are skipped unless `--force` is passed.
Use `--limit` for a smoke test and `--dry-run` to verify source availability
without writing files or metadata. The metadata repair command reads the official
Calamity item sources and records vertical animation frame sizes so sprite sheets
render as a single inventory icon.

## Generated timelines

The versioned definition at
`database/data/game-planners/terraria-calamity.json` contains taxonomy and
algorithm parameters only. It deliberately contains no hand-authored milestones,
item availability or planner steps.

Run the generator after importing or updating the game dataset:

```shell
php artisan migrate --force
php artisan game-data:build-planners
```

The `availability-power-v4` engine builds the timeline from catalog facts:

1. It establishes acquisition anchors from drops, explicit game-state flags and
   declared progression constraints.
2. It resolves recipe dependencies to a fixed point. A crafted item becomes
   available only when every ingredient has at least one available alternative;
   unresolved recipes do not create false availability.
3. It estimates boss gates from objective NPC combat statistics, anchored to the
   Wall of Flesh and Moon Lord phase boundaries, while respecting explicit
   Hardmode and post-Moon Lord floors found in item data.
4. It creates milestone boundaries from the distribution of actually obtainable
   weapons instead of loading a predefined boss order.
5. It classifies weapons, armor and accessories for each class/subclass, computes
   a role-specific power score, and emits every derived milestone with the best
   loadout known at that point, including incomplete early-game builds.

Every derived row records its algorithm version, score/rank and confidence. Items
whose acquisition cannot be established remain queryable in the catalog but are
excluded from generated recommendations. Re-running the command is deterministic
for the same dataset and replaces only generated data for the selected track.

## Operations

After replacing the catalog, normalize its explicit version metadata, rebuild
the derived planners, import icons and verify coverage:

```shell
php artisan game-data:normalize-versions
php artisan game-data:build-planners
php artisan game-data:import-icons --mod=all --calamity-repository=/path/to/CalamityModPublic
php artisan game-data:audit
php artisan game-data:snapshot-planners
```

Planner lists, timelines and catalog totals are cached for
`GAME_DATA_CACHE_TTL` seconds. Commands that change definitions, generated
planners, versions or icons rotate the cache revision automatically. Planner
snapshots are written to `storage/app/private/game-data/snapshots` by default
and should be included in the normal server backup policy.
