import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    Boxes,
    ChevronRight,
    LoaderCircle,
    Search,
    Shield,
    Sparkles,
    Swords,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type IconAsset = {
    url: string;
    width?: number;
    height?: number;
};

type ItemSummary = {
    global_id: string;
    display_name: string;
    mod_name?: string;
    rarity_text?: string | null;
    tooltip?: string | null;
    description?: string | null;
    stats?: Record<string, number | string | null>;
    icon?: IconAsset | null;
};

type PlannerItem = {
    id: number;
    slot_type: string;
    priority: number;
    notes?: string | null;
    item: ItemSummary | null;
};

type TimelineStep = {
    id: number;
    title: string;
    milestone_name: string;
    milestone_description?: string | null;
    items: PlannerItem[];
};

type Planner = {
    planner_key: string;
    name: string;
    description?: string | null;
    archetype_name: string;
    status: string;
    version: string;
    timeline: TimelineStep[];
};

type PlannerSummary = Omit<Planner, 'timeline'> & {
    archetype_key: string;
    steps_count: number;
};

type Archetype = {
    archetype_key: string;
    name: string;
    kind: string;
    parent_key?: string | null;
    description?: string | null;
};

type Overview = {
    totals: Record<'items' | 'npcs' | 'recipes' | 'drops' | 'icons', number>;
};

type ItemDetail = {
    item: ItemSummary & { game_version?: string; mod_version?: string | null };
    icon?: IconAsset | null;
    stats_map: Record<
        string,
        { value: number | string | null; unit?: string | null }
    >;
    categories: Array<{ name: string }>;
    combat_classes: Array<{ name: string }>;
    drops: Array<Record<string, unknown>>;
    recipes: Array<Record<string, unknown>>;
    acquisition_methods: Array<Record<string, unknown>>;
    planner?: {
        availability?: Array<Record<string, unknown>>;
        recommendations?: Array<Record<string, unknown>>;
    };
};

type ApiPayload<T> = { data: T; message?: string };

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });
    const payload = (await response.json()) as ApiPayload<T>;

    if (!response.ok) {
        throw new Error(
            payload.message ?? `Falha na consulta (${response.status}).`,
        );
    }

    return payload.data;
}

function ItemIcon({
    item,
    size = 'md',
}: {
    item: ItemSummary;
    size?: 'sm' | 'md';
}) {
    const classes = size === 'sm' ? 'size-9' : 'size-12';

    return (
        <div
            className={`${classes} grid shrink-0 place-items-center rounded-md border border-border bg-black/20 p-1`}
        >
            {item.icon?.url ? (
                <img
                    src={item.icon.url}
                    alt=""
                    className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                    loading="lazy"
                />
            ) : (
                <Boxes className="size-5 text-muted-foreground" />
            )}
        </div>
    );
}

export default function GameDataIndex() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [archetypes, setArchetypes] = useState<Archetype[]>([]);
    const [planners, setPlanners] = useState<PlannerSummary[]>([]);
    const [selectedPlannerKey, setSelectedPlannerKey] = useState('');
    const [planner, setPlanner] = useState<Planner | null>(null);
    const [loadingPlanner, setLoadingPlanner] = useState(false);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ItemSummary[]>([]);
    const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPlanner = useCallback(async (plannerKey: string) => {
        if (!plannerKey) {
return;
}

        setLoadingPlanner(true);
        setError(null);

        try {
            setPlanner(
                await getJson<Planner>(
                    `/dashboard/game-data/planners/${encodeURIComponent(plannerKey)}`,
                ),
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Falha ao carregar o planner.',
            );
        } finally {
            setLoadingPlanner(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        Promise.all([
            getJson<Overview>('/dashboard/game-data'),
            getJson<Archetype[]>('/dashboard/game-data/classes'),
            getJson<PlannerSummary[]>(
                '/dashboard/game-data/planners?status=published',
            ),
        ])
            .then(([overviewData, archetypeData, plannerData]) => {
                if (!active) {
return;
}

                setOverview(overviewData);
                setArchetypes(archetypeData);
                setPlanners(plannerData);
                const first = plannerData[0]?.planner_key ?? '';
                setSelectedPlannerKey(first);

                if (first) {
void loadPlanner(first);
}
            })
            .catch((reason: unknown) => {
                if (active) {
setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Falha ao carregar os dados.',
                    );
}
            });

        return () => {
            active = false;
        };
    }, [loadPlanner]);

    const classGroups = useMemo(() => {
        const roots = archetypes.filter((entry) => entry.kind === 'class');

        return roots.map((root) => ({
            ...root,
            subclasses: archetypes.filter(
                (entry) => entry.parent_key === root.archetype_key,
            ),
        }));
    }, [archetypes]);

    function selectPlanner(plannerKey: string) {
        setSelectedPlannerKey(plannerKey);
        void loadPlanner(plannerKey);
    }

    async function searchItems(event: FormEvent) {
        event.preventDefault();

        if (!query.trim()) {
return;
}

        setSearching(true);
        setError(null);

        try {
            setSearchResults(
                await getJson<ItemSummary[]>(
                    `/dashboard/game-data/items?q=${encodeURIComponent(query.trim())}&per_page=24`,
                ),
            );
        } catch (reason) {
            setError(
                reason instanceof Error ? reason.message : 'Falha na busca.',
            );
        } finally {
            setSearching(false);
        }
    }

    async function inspectItem(globalId: string) {
        setError(null);

        try {
            setSelectedItem(
                await getJson<ItemDetail>(
                    `/dashboard/game-data/items/${encodeURIComponent(globalId)}`,
                ),
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Falha ao abrir o item.',
            );
        }
    }

    return (
        <>
            <Head title="Game Planner" />
            <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6">
                <header className="overflow-hidden rounded-xl border border-border bg-card p-5 md:p-7">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div>
                            <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
                                <Sparkles className="size-4" /> Rechi OS / Game
                                Data
                            </p>
                            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                                Terraria + Calamity Planner
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                                Progressão construída por regras de obtenção,
                                receitas, drops, chefes e requisitos — sem
                                timeline fixa escrita à mão.
                            </p>
                        </div>
                        <form
                            onSubmit={searchItems}
                            className="flex w-full max-w-xl gap-2"
                        >
                            <label className="relative flex-1">
                                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    className="h-11 w-full rounded-md border border-input bg-background pr-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Buscar qualquer item..."
                                />
                            </label>
                            <button
                                className="h-11 rounded-md bg-primary px-4 font-bold text-primary-foreground"
                                type="submit"
                            >
                                {searching ? (
                                    <LoaderCircle className="size-5 animate-spin" />
                                ) : (
                                    'Buscar'
                                )}
                            </button>
                        </form>
                    </div>
                </header>

                {error && (
                    <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                        <AlertCircle className="size-5 text-destructive" />{' '}
                        {error}
                    </div>
                )}

                {overview && (
                    <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        {Object.entries(overview.totals)
                            .filter(([key]) =>
                                [
                                    'items',
                                    'npcs',
                                    'recipes',
                                    'drops',
                                    'icons',
                                ].includes(key),
                            )
                            .map(([label, value]) => (
                                <article
                                    key={label}
                                    className="rounded-lg border border-border bg-card p-4"
                                >
                                    <strong className="block text-2xl text-primary">
                                        {value.toLocaleString('pt-BR')}
                                    </strong>
                                    <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                        {label}
                                    </span>
                                </article>
                            ))}
                    </section>
                )}

                {searchResults.length > 0 && (
                    <section className="rounded-xl border border-border bg-card p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">
                                Resultado da busca
                            </h2>
                            <button
                                className="text-sm text-muted-foreground hover:text-foreground"
                                onClick={() => setSearchResults([])}
                            >
                                fechar
                            </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {searchResults.map((item) => (
                                <button
                                    key={item.global_id}
                                    onClick={() =>
                                        void inspectItem(item.global_id)
                                    }
                                    className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-primary/60 hover:bg-primary/5"
                                >
                                    <ItemIcon item={item} size="sm" />
                                    <span className="min-w-0">
                                        <strong className="block truncate text-sm">
                                            {item.display_name}
                                        </strong>
                                        <small className="text-muted-foreground">
                                            {item.mod_name}
                                        </small>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="h-fit rounded-xl border border-border bg-card p-4 xl:sticky xl:top-4">
                        <h2 className="mb-3 flex items-center gap-2 font-bold">
                            <Swords className="size-4 text-primary" /> Classes e
                            subclasses
                        </h2>
                        <div className="grid gap-4">
                            {classGroups.map((group) => (
                                <div key={group.archetype_key}>
                                    <p className="mb-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                        {group.name}
                                    </p>
                                    <div className="grid gap-1">
                                        {[group, ...group.subclasses].map(
                                            (archetype) => {
                                                const summary = planners.find(
                                                    (entry) =>
                                                        entry.archetype_key ===
                                                        archetype.archetype_key,
                                                );

                                                if (!summary) {
return null;
}

                                                return (
                                                    <button
                                                        key={
                                                            archetype.archetype_key
                                                        }
                                                        onClick={() =>
                                                            selectPlanner(
                                                                summary.planner_key,
                                                            )
                                                        }
                                                        className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${selectedPlannerKey === summary.planner_key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                                    >
                                                        <span>
                                                            {archetype.name}
                                                        </span>
                                                        <ChevronRight className="size-4" />
                                                    </button>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <section className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-6">
                        {loadingPlanner ? (
                            <div className="grid min-h-64 place-items-center">
                                <LoaderCircle className="size-8 animate-spin text-primary" />
                            </div>
                        ) : planner ? (
                            <>
                                <div className="mb-6">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="rounded-full bg-primary/15 px-2 py-1 font-bold text-primary">
                                            {planner.archetype_name}
                                        </span>
                                        <span className="rounded-full bg-muted px-2 py-1">
                                            v{planner.version}
                                        </span>
                                        <span className="rounded-full bg-muted px-2 py-1">
                                            {planner.timeline.length} fases
                                        </span>
                                    </div>
                                    <h2 className="mt-3 text-2xl font-black">
                                        {planner.name}
                                    </h2>
                                    {planner.description && (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {planner.description}
                                        </p>
                                    )}
                                </div>
                                <ol className="relative ml-3 border-l border-primary/30 pl-7">
                                    {planner.timeline.map((step, index) => (
                                        <li
                                            key={step.id}
                                            className="relative pb-8 last:pb-0"
                                        >
                                            <span className="absolute top-0 -left-[2.45rem] grid size-5 place-items-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                                                {index + 1}
                                            </span>
                                            <h3 className="text-lg font-bold">
                                                {step.title ||
                                                    step.milestone_name}
                                            </h3>
                                            {step.milestone_description && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {step.milestone_description}
                                                </p>
                                            )}
                                            <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                                                {step.items.map(
                                                    (recommendation) =>
                                                        recommendation.item && (
                                                            <button
                                                                key={
                                                                    recommendation.id
                                                                }
                                                                onClick={() =>
                                                                    void inspectItem(
                                                                        recommendation
                                                                            .item!
                                                                            .global_id,
                                                                    )
                                                                }
                                                                className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left hover:border-primary/50"
                                                            >
                                                                <ItemIcon
                                                                    item={
                                                                        recommendation.item
                                                                    }
                                                                />
                                                                <span className="min-w-0">
                                                                    <small className="block text-[10px] font-bold tracking-wider text-primary uppercase">
                                                                        {
                                                                            recommendation.slot_type
                                                                        }
                                                                    </small>
                                                                    <strong className="block truncate text-sm">
                                                                        {
                                                                            recommendation
                                                                                .item
                                                                                .display_name
                                                                        }
                                                                    </strong>
                                                                    <small className="text-muted-foreground">
                                                                        {
                                                                            recommendation
                                                                                .item
                                                                                .mod_name
                                                                        }
                                                                    </small>
                                                                </span>
                                                            </button>
                                                        ),
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </>
                        ) : (
                            <div className="grid min-h-64 place-items-center text-muted-foreground">
                                Nenhum planner publicado.
                            </div>
                        )}
                    </section>
                </div>

                {selectedItem && (
                    <section className="rounded-xl border border-primary/30 bg-card p-5 md:p-7">
                        <div className="flex flex-col gap-5 lg:flex-row">
                            <ItemIcon
                                item={{
                                    ...selectedItem.item,
                                    icon: selectedItem.icon,
                                }}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold tracking-wider text-primary uppercase">
                                            {selectedItem.item.mod_name}
                                        </p>
                                        <h2 className="text-2xl font-black">
                                            {selectedItem.item.display_name}
                                        </h2>
                                        <code className="text-xs text-muted-foreground">
                                            {selectedItem.item.global_id}
                                        </code>
                                    </div>
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="text-sm text-muted-foreground hover:text-foreground"
                                    >
                                        fechar
                                    </button>
                                </div>
                                {(selectedItem.item.tooltip ||
                                    selectedItem.item.description) && (
                                    <p className="mt-4 max-w-4xl text-sm text-muted-foreground">
                                        {selectedItem.item.tooltip ||
                                            selectedItem.item.description}
                                    </p>
                                )}
                                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {Object.entries(selectedItem.stats_map).map(
                                        ([key, stat]) => (
                                            <div
                                                key={key}
                                                className="rounded-md border border-border p-3"
                                            >
                                                <small className="block text-muted-foreground uppercase">
                                                    {key.replaceAll('_', ' ')}
                                                </small>
                                                <strong>
                                                    {String(stat.value ?? '—')}{' '}
                                                    {stat.unit ?? ''}
                                                </strong>
                                            </div>
                                        ),
                                    )}
                                </div>
                                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                                    {selectedItem.combat_classes.map(
                                        (entry) => (
                                            <span
                                                key={entry.name}
                                                className="rounded-full bg-primary/15 px-3 py-1 text-primary"
                                            >
                                                <Swords className="mr-1 inline size-3" />
                                                {entry.name}
                                            </span>
                                        ),
                                    )}
                                    {selectedItem.categories.map((entry) => (
                                        <span
                                            key={entry.name}
                                            className="rounded-full bg-muted px-3 py-1"
                                        >
                                            <Shield className="mr-1 inline size-3" />
                                            {entry.name}
                                        </span>
                                    ))}
                                    <span className="rounded-full bg-muted px-3 py-1">
                                        {selectedItem.recipes.length} receitas
                                    </span>
                                    <span className="rounded-full bg-muted px-3 py-1">
                                        {selectedItem.drops.length} drops
                                    </span>
                                    <span className="rounded-full bg-muted px-3 py-1">
                                        {
                                            selectedItem.acquisition_methods
                                                .length
                                        }{' '}
                                        formas de obter
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}

GameDataIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Game Planner', href: '/dashboard/game-planner' },
    ],
};
