<?php

namespace Tests\Feature;

use Tests\TestCase;

class MigrationRollbackTest extends TestCase
{
    public function test_all_migrations_can_be_rolled_back_and_reapplied(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        $this->artisan('migrate:rollback')->assertSuccessful();
        $this->artisan('migrate')->assertSuccessful();
    }
}
