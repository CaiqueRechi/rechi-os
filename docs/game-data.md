# Game data dashboard backend

The protected game catalog lives under `/dashboard/game-data` and requires an
authenticated, verified administrator with the `managePortfolio` ability.

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

The `availability-power-v1` engine builds the timeline from catalog facts:

1. It establishes acquisition anchors from drops, explicit game-state flags and
   declared progression constraints.
2. It resolves recipe dependencies to a fixed point. A crafted item becomes
   available only when every ingredient has at least one available alternative;
   unresolved recipes do not create false availability.
3. It estimates boss gates from objective NPC combat statistics, while respecting
   explicit Hardmode and post-Moon Lord floors found in item data.
4. It creates milestone boundaries from the distribution of actually obtainable
   weapons instead of loading a predefined boss order.
5. It classifies weapons, armor and accessories for each class/subclass, computes
   a role-specific power score, and emits a step only when the best available
   loadout changes by the configured minimum percentage.

Every derived row records its algorithm version, score/rank and confidence. Items
whose acquisition cannot be established remain queryable in the catalog but are
excluded from generated recommendations. Re-running the command is deterministic
for the same dataset and replaces only generated data for the selected track.
