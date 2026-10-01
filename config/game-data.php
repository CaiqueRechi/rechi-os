<?php

return [
    'connection' => env('GAME_DATA_DB_CONNECTION', env('DB_CONNECTION', 'mysql')),
    'max_per_page' => (int) env('GAME_DATA_MAX_PER_PAGE', 100),
    'cache_ttl' => (int) env('GAME_DATA_CACHE_TTL', 900),
    'icons' => [
        'disk' => env('GAME_DATA_ICON_DISK', 'public'),
        'prefix' => env('GAME_DATA_ICON_PREFIX', 'game-data/items'),
        'calamity_repository' => env('CALAMITY_ASSET_REPOSITORY'),
        'calamity_raw_base_url' => env(
            'CALAMITY_ASSET_RAW_BASE_URL',
            'https://raw.githubusercontent.com/CalamityTeam/CalamityModPublic/1.4.4'
        ),
        'calamity_source_revision' => env(
            'CALAMITY_SOURCE_REVISION',
            '1a8cebd27ec5615316b78f71973446b5528d2b78'
        ),
        'terraria_wiki_api' => env('TERRARIA_WIKI_API', 'https://terraria.wiki.gg/api.php'),
    ],
    'versions' => [
        'terraria' => env('TERRARIA_DATA_VERSION', '1.4.4'),
        'calamity' => env('CALAMITY_DATA_VERSION', '2.2.2'),
    ],
    'planner_definitions_path' => env(
        'GAME_DATA_PLANNER_DEFINITIONS_PATH',
        database_path('data/game-planners/terraria-calamity.json')
    ),
    'boss_checklist_path' => env(
        'GAME_DATA_BOSS_CHECKLIST_PATH',
        database_path('data/game-planners/terraria-boss-checklist.json')
    ),
];
