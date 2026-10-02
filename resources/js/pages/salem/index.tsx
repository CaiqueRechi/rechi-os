import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Cat,
    Coins,
    Gamepad2,
    Minus,
    Package,
    Plus,
    ShieldCheck,
    ShoppingCart,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { tradeSalemItem } from '@/features/salem/api/salem-api';
import type { Auth, SalemMarketItem, SalemSave } from '@/types';

type SalemDashboardProps = {
    initialSave: SalemSave;
    market: SalemMarketItem[];
    access: {
        level: 'none' | 'read' | 'write';
        canWrite: boolean;
    };
};

const accessLabels = {
    none: 'N/A',
    read: 'Leitura',
    write: 'Escrita',
} as const;

export default function SalemDashboard({
    initialSave,
    market,
    access,
}: SalemDashboardProps) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [save, setSave] = useState(initialSave);
    const [items, setItems] = useState(market);
    const [busyItemId, setBusyItemId] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);

    const inventoryCount = useMemo(
        () => items.reduce((total, item) => total + item.owned, 0),
        [items],
    );
    const levelProgress = save.xp % 100;

    async function handleTrade(item: SalemMarketItem, action: 'buy' | 'sell') {
        if (!access.canWrite) {
            return;
        }

        setBusyItemId(item.id);
        setFeedback(null);

        try {
            const response = await tradeSalemItem(item.id, action);
            setSave(response.save);
            setItems((current) =>
                current.map((candidate) =>
                    candidate.id === response.item.id
                        ? response.item
                        : candidate,
                ),
            );
            setFeedback({ type: 'success', message: response.message });
        } catch (error) {
            setFeedback({
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível concluir a negociação.',
            });
        } finally {
            setBusyItemId(null);
        }
    }

    return (
        <>
            <Head title="Salém" />
            <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
                <header className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_8%_110%,rgba(245,158,11,0.14),transparent_30%)]" />
                    <div className="relative flex flex-col justify-between gap-6 p-5 md:flex-row md:items-end md:p-7">
                        <div className="flex items-start gap-4">
                            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                                <Cat className="size-7" />
                            </span>
                            <div>
                                <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
                                    Salém / Painel
                                </p>
                                <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
                                    Olá, {auth.user.name.split(' ')[0]}
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                                    Gerencie o progresso, inventário e as
                                    negociações do seu Salém.
                                </p>
                            </div>
                        </div>

                        <Link
                            href="/salem/jogar"
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                        >
                            <Gamepad2 className="size-4" /> Entrar no mundo
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>
                </header>

                {!access.canWrite ? (
                    <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-foreground">
                        Seu acesso é de <strong>leitura</strong>. Você pode
                        consultar esta tela e entrar no mundo, mas nenhuma
                        informação será alterada.
                    </div>
                ) : null}

                {feedback ? (
                    <div
                        className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-destructive/25 bg-destructive/10 text-destructive'}`}
                    >
                        {feedback.message}
                    </div>
                ) : null}

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Cozy Points"
                        value={save.cozy_points.toLocaleString('pt-BR')}
                        detail="Saldo disponível"
                        icon={Coins}
                    />
                    <StatCard
                        label="Nível"
                        value={String(save.level)}
                        detail={`${levelProgress}/100 XP para o próximo`}
                        icon={Cat}
                    />
                    <StatCard
                        label="Inventário"
                        value={String(inventoryCount)}
                        detail="Itens armazenados"
                        icon={Package}
                    />
                    <StatCard
                        label="Acesso"
                        value={accessLabels[access.level]}
                        detail="Permissão nesta tela"
                        icon={ShieldCheck}
                    />
                </section>

                <section className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center md:px-6">
                        <div>
                            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-primary uppercase">
                                <ShoppingCart className="size-4" /> Mercado
                            </p>
                            <h2 className="mt-1 text-xl font-bold">
                                Comprar e vender itens
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Os valores são calculados em Cozy Points.
                            </p>
                        </div>
                        <span className="w-fit rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                            {items.length} itens disponíveis
                        </span>
                    </div>

                    <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6 xl:grid-cols-3">
                        {items.map((item) => {
                            const busy = busyItemId === item.id;
                            const canBuy =
                                access.canWrite &&
                                item.buy_price !== null &&
                                save.cozy_points >= item.buy_price;
                            const canSell =
                                access.canWrite &&
                                item.sell_price !== null &&
                                item.owned > 0;

                            return (
                                <article
                                    key={item.id}
                                    className="flex min-h-56 flex-col rounded-xl border border-border bg-background p-4 transition hover:border-primary/35 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                                            <Package className="size-5" />
                                        </span>
                                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                            {item.owned} no inventário
                                        </span>
                                    </div>
                                    <h3 className="mt-4 font-bold">
                                        {item.name}
                                    </h3>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                        {item.description}
                                    </p>

                                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                                        <button
                                            type="button"
                                            disabled={!canBuy || busy}
                                            onClick={() =>
                                                void handleTrade(item, 'buy')
                                            }
                                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Plus className="size-3.5" />{' '}
                                            Comprar
                                            {item.buy_price !== null
                                                ? ` ${item.buy_price}`
                                                : ''}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canSell || busy}
                                            onClick={() =>
                                                void handleTrade(item, 'sell')
                                            }
                                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <Minus className="size-3.5" />{' '}
                                            Vender
                                            {item.sell_price !== null
                                                ? ` ${item.sell_price}`
                                                : ''}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </main>
        </>
    );
}

type StatCardProps = {
    label: string;
    value: string;
    detail: string;
    icon: typeof Coins;
};

function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
    return (
        <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {label}
                    </p>
                    <strong className="mt-2 block text-2xl font-black">
                        {value}
                    </strong>
                </div>
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
        </article>
    );
}

SalemDashboard.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Biblioteca', href: '/dashboard/biblioteca' },
        { title: 'Salém', href: '/salem' },
    ],
};
