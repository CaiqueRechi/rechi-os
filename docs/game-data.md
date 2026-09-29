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

The backend uses `GAME_DATA_DB_CONNECTION`, defaulting to the main application
connection. It can move to a dedicated database without changing routes.

The dataset is generated offline and imported from
`terraria_dataset_mariadb.sql`; normal web requests never fetch Wiki/GitHub data.
