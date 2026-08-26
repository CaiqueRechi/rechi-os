<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_the_seeded_public_profile(): void
    {
        $this->seed();

        $this->getJson('/api/v1/profile')
            ->assertOk()
            ->assertJsonPath('data.name', 'Caique Rechi')
            ->assertHeader('ETag');
    }

    public function test_returns_project_case_studies_by_slug(): void
    {
        $this->seed();

        $this->getJson('/api/v1/projects/ims')
            ->assertOk()
            ->assertJsonPath('data.slug', 'ims')
            ->assertJsonPath('data.featured', true);
    }
}
