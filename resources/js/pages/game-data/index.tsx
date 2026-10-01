import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    Boxes,
    Calculator,
    GitBranch,
    Package,
    ScrollText,
    Shield,
    Skull,
    Sparkles,
    Sword,
    Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type Overview = {
    totals: Record<'items' | 'npcs' | 'recipes' | 'drops' | 'icons', number>;
};

type ApiPayload<T> = { data: T; message?: string };

const counters = [
    { key: 'items', label: 'Itens', icon: Package },
    { key: 'npcs', label: 'NPCs', icon: Skull },
    { key: 'recipes', label: 'Receitas', icon: Wrench },
    { key: 'drops', label: 'Drops', icon: Boxes },
    { key: 'icons', label: 'Ícones', icon: Sparkles },
] as const;

async function getOverview(): Promise<Overview> {
    const response = await fetch('/dashboard/game-data', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });
    const payload = (await response.json()) as ApiPayload<Overview>;

    if (!response.ok) {
        throw new Error(payload.message ?? 'Falha ao carregar o catálogo.');
    }

    return payload.data;
}

function InventoryPreview() {
    return (
        <div className="relative min-h-56 overflow-hidden border-b border-border bg-[#0d0c16] p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(230_92_50/0.18),transparent_55%),linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:auto,18px_18px,18px_18px]" />
            <div className="relative mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center gap-5">
                <div className="space-y-3">
                    <span className="grid aspect-square place-items-center rounded-lg border border-primary/50 bg-primary/10">
                        <Sword className="size-9 text-primary" />
                    </span>
                    <p className="text-center text-[9px] font-black tracking-wider text-muted-foreground uppercase">
                        Arma
                    </p>
                </div>
                <div className="grid gap-2">
                    {[Shield, Shield, Shield].map((Icon, index) => (
                        <span
                            key={index}
                            className="grid size-14 place-items-center rounded-md border border-[#51446b] bg-[#211b33]"
                        >
                            <Icon className="size-6 text-[#a79ac4]" />
                        </span>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <span
                            key={index}
                            className="grid aspect-square place-items-center rounded-md border border-[#51446b] bg-[#211b33] text-xs font-black text-[#a79ac4]"
                        >
                            {index + 1}
                        </span>
                    ))}
                </div>
            </div>
            <div className="relative mx-auto mt-5 grid max-w-md grid-cols-3 gap-2 text-center">
                {['Dano', 'Defesa', 'DPS'].map((label) => (
                    <span
                        key={label}
                        className="rounded border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-black tracking-wider text-[#d9d2e5] uppercase"
                    >
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function TimelinePreview() {
    return (
        <div className="relative min-h-56 overflow-hidden border-b border-border bg-[#0d0c16] p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(83_61_120/0.32),transparent_50%),linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:auto,18px_18px,18px_18px]" />
            <div className="relative mx-auto flex max-w-lg items-center justify-between pt-14">
                <span className="absolute top-[4.45rem] right-8 left-8 h-1 rounded bg-gradient-to-r from-[#e65c32] via-[#e8cf8b] to-[#7a5ba5]" />
                {['Início', 'Hardmode', 'Moon Lord', 'Calamity'].map(
                    (label, index) => (
                        <div
                            key={label}
                            className="relative z-10 flex flex-col items-center gap-3"
                        >
                            <span className="grid size-10 place-items-center rounded-full border-2 border-[#e8cf8b] bg-[#171424] text-xs font-black text-[#e8cf8b] shadow-[0_0_20px_rgb(232_207_139/0.18)]">
                                {index + 1}
                            </span>
                            <small className="text-[9px] font-black tracking-wider text-[#c9c1d7] uppercase">
                                {label}
                            </small>
                        </div>
                    ),
                )}
            </div>
            <div className="relative mx-auto mt-7 flex max-w-lg items-center justify-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="size-4 text-primary" /> 55 marcos
                calculados pela disponibilidade dos itens
            </div>
        </div>
    );
}

export default function TerrariaHome() {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        void getOverview()
            .then((data) => active && setOverview(data))
            .catch((reason: unknown) => {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Falha ao carregar o catálogo.',
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    return (
        <>
            <Head title="Terraria" />
            <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6">
                <header className="relative overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8">
                    <div className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_60%_40%,rgb(230_92_50/0.22),transparent_60%)] lg:block" />
                    <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                        <div>
                            <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
                                <Sparkles className="size-4" /> Terraria +
                                Calamity
                            </p>
                            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                                Central de builds
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                                Monte equipamentos livremente ou acompanhe a
                                progressão calculada a partir de drops, receitas
                                e Boss Checklist.
                            </p>
                        </div>
                        <img
                            src="/images/games/terraria-logo.png"
                            alt="Terraria"
                            className="h-auto w-full max-w-64 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]"
                        />
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {counters.map(({ key, label, icon: Icon }) => (
                        <article
                            key={key}
                            className="rounded-lg border border-border bg-card p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <strong className="block text-2xl text-primary">
                                    {overview
                                        ? overview.totals[key].toLocaleString(
                                              'pt-BR',
                                          )
                                        : '—'}
                                </strong>
                                <Icon className="size-4 text-muted-foreground" />
                            </div>
                            <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                {label}
                            </span>
                        </article>
                    ))}
                </section>

                {error && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                    </p>
                )}

                <section className="grid gap-5 xl:grid-cols-2">
                    <Link
                        href="/dashboard/biblioteca/terraria/planner"
                        prefetch
                        className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <InventoryPreview />
                        <div className="flex items-end justify-between gap-5 p-5 md:p-6">
                            <div>
                                <p className="flex items-center gap-2 text-xs font-black tracking-wider text-primary uppercase">
                                    <Calculator className="size-4" /> Ferramenta
                                    interativa
                                </p>
                                <h2 className="mt-2 text-2xl font-black">
                                    Planner
                                </h2>
                                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                                    Monte um inventário, troque cada equipamento
                                    e veja dano, defesa, crítico e DPS
                                    recalculados.
                                </p>
                            </div>
                            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                                <ArrowRight className="size-5" />
                            </span>
                        </div>
                    </Link>

                    <Link
                        href="/dashboard/biblioteca/terraria/timeline"
                        prefetch
                        className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <TimelinePreview />
                        <div className="flex items-end justify-between gap-5 p-5 md:p-6">
                            <div>
                                <p className="flex items-center gap-2 text-xs font-black tracking-wider text-primary uppercase">
                                    <ScrollText className="size-4" /> Progressão
                                    calculada
                                </p>
                                <h2 className="mt-2 text-2xl font-black">
                                    Timeline
                                </h2>
                                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                                    Explore as builds recomendadas em cada boss,
                                    miniboss e evento da progressão.
                                </p>
                            </div>
                            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                                <ArrowRight className="size-5" />
                            </span>
                        </div>
                    </Link>
                </section>
            </main>
        </>
    );
}

TerrariaHome.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Biblioteca', href: '/dashboard/biblioteca' },
        { title: 'Terraria', href: '/dashboard/biblioteca/terraria' },
    ],
};
