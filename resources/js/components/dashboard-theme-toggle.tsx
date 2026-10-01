import { Moon, Sun } from 'lucide-react';
import { useAppearance } from '@/hooks/use-appearance';

export function DashboardThemeToggle() {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';
    const nextMode = isDark ? 'light' : 'dark';

    return (
        <button
            type="button"
            onClick={() => updateAppearance(nextMode)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={`Ativar modo ${nextMode === 'dark' ? 'escuro' : 'claro'}`}
            title={`Ativar modo ${nextMode === 'dark' ? 'escuro' : 'claro'}`}
        >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="hidden sm:inline">
                {isDark ? 'Modo claro' : 'Modo escuro'}
            </span>
        </button>
    );
}
