<?php

return [
    'connection' => env('GAME_DATA_DB_CONNECTION', env('DB_CONNECTION', 'mysql')),
    'max_per_page' => (int) env('GAME_DATA_MAX_PER_PAGE', 100),
    'planner_definitions_path' => env(
        'GAME_DATA_PLANNER_DEFINITIONS_PATH',
        database_path('data/game-planners/terraria-calamity.json')
    ),
];
