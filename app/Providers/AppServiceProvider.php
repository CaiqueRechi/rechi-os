<?php

namespace App\Providers;

use App\Models\Experience;
use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\SocialLink;
use App\Observers\PortfolioCacheObserver;
use App\Services\Ai\AiGateway;
use App\Services\Ai\OpenAiResponsesGateway;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(AiGateway::class, OpenAiResponsesGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureObservers();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );

        RateLimiter::for('api-public', fn (Request $request) => Limit::perMinute(60)->by((string) $request->ip()));
        RateLimiter::for('contact', fn (Request $request) => Limit::perMinute(3)->by((string) $request->ip()));
        RateLimiter::for('assistant', fn (Request $request) => Limit::perMinute(10)->by((string) $request->ip().'|'.$request->session()->getId()));

        Gate::define('managePortfolio', fn ($user): bool => (bool) $user->is_admin);
    }

    protected function configureObservers(): void
    {
        Profile::observe(PortfolioCacheObserver::class);
        Project::observe(PortfolioCacheObserver::class);
        Experience::observe(PortfolioCacheObserver::class);
        SkillCategory::observe(PortfolioCacheObserver::class);
        Skill::observe(PortfolioCacheObserver::class);
        SocialLink::observe(PortfolioCacheObserver::class);
    }
}
