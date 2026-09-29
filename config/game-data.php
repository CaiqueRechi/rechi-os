<?php

return [
    'connection' => env('GAME_DATA_DB_CONNECTION', env('DB_CONNECTION', 'mysql')),
    'max_per_page' => (int) env('GAME_DATA_MAX_PER_PAGE', 100),
];
