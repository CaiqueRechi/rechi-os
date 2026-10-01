import { Head } from '@inertiajs/react';
import {
    Boxes,
    Calculator,
    ChevronLeft,
    ChevronRight,
    Filter,
    LoaderCircle,
    Plus,
    RotateCcw,
    Search,
    Shield,
    Sparkles,
    Sword,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type IconAsset = {
    url: string;
    width?: number;
    height?: number;
    metadata_json?: { frame_height?: number } | null;
};

type ItemSummary = {
    global_id: string;
    display_name: string;
    mod_name?: string;
    tooltip?: string | null;
    rarity_text?: string | null;
    stats?: Record<string, number | string | null>;
    icon?: IconAsset | null;
};

type PaginationMeta = {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
};

type ItemSource = 'all' | 'vanilla' | 'calamity';
type ItemOrder = 'name-asc' | 'name-desc' | 'rarity-asc' | 'rarity-desc';

type SlotKey =
    | 'weapon'
    | 'armor_head'
    | 'armor_body'
    | 'armor_legs'
    | 'accessory_1'
    | 'accessory_2'
    | 'accessory_3'
    | 'accessory_4'
    | 'accessory_5';

type ReforgeKey = 'warding' | 'lucky' | 'menacing';

const emptyLoadout: Record<SlotKey, ItemSummary | null> = {
    weapon: null,
    armor_head: null,
    armor_body: null,
    armor_legs: null,
    accessory_1: null,
    accessory_2: null,
    accessory_3: null,
    accessory_4: null,
    accessory_5: null,
};

const slotLabels: Record<SlotKey, string> = {
    weapon: 'Arma principal',
    armor_head: 'Capacete',
    armor_body: 'Peitoral',
    armor_legs: 'Pernas',
    accessory_1: 'Acessório 1',
    accessory_2: 'Acessório 2',
    accessory_3: 'Acessório 3',
    accessory_4: 'Acessório 4',
    accessory_5: 'Acessório 5',
};

const accessorySlots: SlotKey[] = [
    'accessory_1',
    'accessory_2',
    'accessory_3',
    'accessory_4',
    'accessory_5',
];

const reforges: Record<
    ReforgeKey,
    { name: string; defense: number; damage: number; critical: number }
> = {
    warding: { name: 'Warding', defense: 4, damage: 0, critical: 0 },
    lucky: { name: 'Lucky', defense: 0, damage: 0, critical: 4 },
    menacing: { name: 'Menacing', defense: 0, damage: 4, critical: 0 },
};

function numericStat(item: ItemSummary | null, ...keys: string[]): number {
    if (!item?.stats) {
        return 0;
    }

    for (const key of keys) {
        const value = item.stats[key];
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }

    return 0;
}

function formatNumber(value: number, digits = 2): string {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function ItemSprite({
    item,
    displaySize,
}: {
    item: ItemSummary;
    displaySize: number;
}) {
    const icon = item.icon;
    if (!icon?.url) {
        return <Boxes className="size-6 text-muted-foreground" />;
    }

    const sourceWidth = Number(icon.width ?? 0);
    const sourceHeight = Number(icon.height ?? 0);
    const metadataFrameHeight = Number(icon.metadata_json?.frame_height ?? 0);
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        return (
            <img
                src={icon.url}
                alt=""
                className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
            />
        );
    }

    const frameHeight =
        metadataFrameHeight > 0 && metadataFrameHeight <= sourceHeight
            ? metadataFrameHeight
            : sourceHeight;
    const scale = Math.min(
        1,
        displaySize / sourceWidth,
        displaySize / frameHeight,
    );

    return (
        <span
            className="block overflow-hidden"
            style={{ width: sourceWidth * scale, height: frameHeight * scale }}
        >
            <img
                src={icon.url}
                alt=""
                className="block max-w-none [image-rendering:pixelated]"
                style={{
                    width: sourceWidth * scale,
                    height: sourceHeight * scale,
                }}
            />
        </span>
    );
}

function EquipmentSlot({
    slot,
    item,
    large = false,
    onOpen,
    onClear,
}: {
    slot: SlotKey;
    item: ItemSummary | null;
    large?: boolean;
    onOpen: () => void;
    onClear: () => void;
}) {
    return (
        <div
            className={`group relative rounded-lg border bg-[#1d1830] transition hover:border-[#e8cf8b] ${
                item ? 'border-[#64547f]' : 'border-dashed border-[#493d5e]'
            } ${large ? 'min-h-40 p-4' : 'min-h-24 p-3'}`}
        >
            <button
                type="button"
                onClick={onOpen}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-center"
            >
                <span
                    className={`grid place-items-center rounded-md border border-black/40 bg-[#0f0d18] ${large ? 'size-20' : 'size-13'}`}
                >
                    {item ? (
                        <ItemSprite item={item} displaySize={large ? 64 : 40} />
                    ) : (
                        <Plus className="size-5 text-[#786b8f]" />
                    )}
                </span>
                <span className="w-full min-w-0">
                    <small className="block text-[8px] font-black tracking-[0.16em] text-[#d7a84b] uppercase">
                        {slotLabels[slot]}
                    </small>
                    <strong className="mt-0.5 block truncate text-xs text-[#fff8dc]">
                        {item?.display_name ?? 'Selecionar item'}
                    </strong>
                    {item?.mod_name && (
                        <small className="block truncate text-[9px] text-[#aaa1bd]">
                            {item.mod_name}
                        </small>
                    )}
                </span>
            </button>
            {item && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label={`Remover ${item.display_name}`}
                    className="absolute top-2 right-2 grid size-6 place-items-center rounded-full border border-white/10 bg-black/40 text-[#aaa1bd] opacity-0 transition group-hover:opacity-100 hover:text-white"
                >
                    <X className="size-3" />
                </button>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note?: string;
}) {
    return (
        <article className="rounded-lg border border-border bg-background/45 p-4">
            <p className="text-[9px] font-black tracking-[0.16em] text-muted-foreground uppercase">
                {label}
            </p>
            <strong className="mt-1 block text-2xl text-primary">
                {value}
            </strong>
            {note && (
                <small className="text-[10px] text-muted-foreground">
                    {note}
                </small>
            )}
        </article>
    );
}

export default function GameBuildPlanner() {
    const [loadout, setLoadout] = useState(emptyLoadout);
    const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ItemSummary[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);
    const [source, setSource] = useState<ItemSource>('all');
    const [order, setOrder] = useState<ItemOrder>('name-asc');
    const [pagination, setPagination] = useState<PaginationMeta>({
        current_page: 1,
        from: null,
        last_page: 1,
        per_page: 24,
        to: null,
        total: 0,
    });
    const [accessoryReforges, setAccessoryReforges] = useState<
        Record<string, ReforgeKey>
    >({
        accessory_1: 'warding',
        accessory_2: 'warding',
        accessory_3: 'lucky',
        accessory_4: 'menacing',
        accessory_5: 'menacing',
    });

    useEffect(() => {
        if (!activeSlot) {
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setSearching(true);
            setError(null);
            const slot = activeSlot.startsWith('accessory')
                ? 'accessory'
                : activeSlot;
            const [sort, direction] = order.split('-');
            const params = new URLSearchParams({
                slot,
                page: String(page),
                per_page: String(pageSize),
                sort,
                direction,
            });
            if (query.trim()) {
                params.set('q', query.trim());
            }
            if (source !== 'all') {
                params.set('mod', source);
            }

            try {
                const response = await fetch(
                    `/dashboard/game-data/items?${params.toString()}`,
                    {
                        signal: controller.signal,
                        headers: { Accept: 'application/json' },
                        credentials: 'same-origin',
                    },
                );
                const payload = (await response.json()) as {
                    data?: ItemSummary[];
                    meta?: PaginationMeta;
                    message?: string;
                };
                if (!response.ok) {
                    throw new Error(payload.message ?? 'Falha na busca.');
                }
                setResults(payload.data ?? []);
                if (payload.meta) {
                    setPagination(payload.meta);
                }
            } catch (reason) {
                if (
                    reason instanceof DOMException &&
                    reason.name === 'AbortError'
                ) {
                    return;
                }
                setError(
                    reason instanceof Error
                        ? reason.message
                        : 'Falha na busca.',
                );
            } finally {
                if (!controller.signal.aborted) {
                    setSearching(false);
                }
            }
        }, 180);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [activeSlot, order, page, pageSize, query, source]);

    const totals = useMemo(() => {
        const items = Object.values(loadout).filter(
            (item): item is ItemSummary => item !== null,
        );
        const baseDamage = numericStat(loadout.weapon, 'damage');
        const useTime = numericStat(
            loadout.weapon,
            'use_time',
            'use_animation',
        );
        const baseCritical = numericStat(
            loadout.weapon,
            'critical_chance',
            'crit',
            'critical',
        );
        const itemDefense = items.reduce(
            (sum, item) => sum + numericStat(item, 'defense'),
            0,
        );
        const activeReforges = accessorySlots
            .filter((slot) => loadout[slot] !== null)
            .map((slot) => reforges[accessoryReforges[slot] ?? 'warding']);
        const defense =
            itemDefense +
            activeReforges.reduce((sum, reforge) => sum + reforge.defense, 0);
        const damagePercent = activeReforges.reduce(
            (sum, reforge) => sum + reforge.damage,
            0,
        );
        const critical =
            baseCritical +
            activeReforges.reduce((sum, reforge) => sum + reforge.critical, 0);
        const damage = baseDamage * (1 + damagePercent / 100);
        const attacksPerSecond = useTime > 0 ? 60 / useTime : 0;
        const dps = damage * attacksPerSecond * (1 + critical / 100);

        return {
            selected: items.length,
            baseDamage,
            damage,
            damagePercent,
            defense,
            critical,
            attacksPerSecond,
            dps,
            mana: numericStat(loadout.weapon, 'mana_cost', 'mana'),
            knockback: numericStat(loadout.weapon, 'knockback'),
        };
    }, [accessoryReforges, loadout]);

    function openSlot(slot: SlotKey) {
        setQuery('');
        setResults([]);
        setPage(1);
        setPageSize(24);
        setSource('all');
        setOrder('name-asc');
        setPagination({
            current_page: 1,
            from: null,
            last_page: 1,
            per_page: 24,
            to: null,
            total: 0,
        });
        setActiveSlot(slot);
    }

    function chooseItem(item: ItemSummary) {
        if (!activeSlot) {
            return;
        }
        setLoadout((current) => ({ ...current, [activeSlot]: item }));
        setActiveSlot(null);
    }

    function clearSlot(slot: SlotKey) {
        setLoadout((current) => ({ ...current, [slot]: null }));
    }

    return (
        <>
            <Head title="Planner | Terraria" />
            <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6">
                <header className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 md:flex-row md:items-end md:p-7">
                    <div>
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
                            <Calculator className="size-4" /> Terraria / Planner
                        </p>
                        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                            Monte sua build
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                            Clique em qualquer slot para trocar o item. Os
                            valores da build são recalculados imediatamente.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setLoadout(emptyLoadout)}
                        className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-bold hover:border-primary"
                    >
                        <RotateCcw className="size-4" /> Limpar build
                    </button>
                </header>

                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
                    <section className="overflow-hidden rounded-xl border border-[#4f4268] bg-[#0d0c16]">
                        <div className="border-b border-[#4f4268] bg-[#211a31] px-5 py-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[9px] font-black tracking-[0.18em] text-[#d7a84b] uppercase">
                                        Inventário
                                    </p>
                                    <h2 className="font-black text-[#fff8dc]">
                                        Equipamentos da build
                                    </h2>
                                </div>
                                <span className="rounded border border-[#d7a84b]/50 bg-[#d7a84b]/10 px-2 py-1 text-[10px] font-black text-[#e8cf8b]">
                                    {totals.selected}/9 slots
                                </span>
                            </div>
                        </div>

                        <div className="relative p-5 md:p-7">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(83_61_120/0.25),transparent_45%),linear-gradient(rgb(255_255_255/0.018)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.018)_1px,transparent_1px)] bg-[size:auto,16px_16px,16px_16px]" />
                            <div className="relative grid gap-6 lg:grid-cols-[minmax(180px,0.8fr)_minmax(280px,1.2fr)]">
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[9px] font-black tracking-wider text-[#d7a84b] uppercase">
                                        <Sword className="size-3" /> Arma
                                    </p>
                                    <EquipmentSlot
                                        slot="weapon"
                                        item={loadout.weapon}
                                        large
                                        onOpen={() => openSlot('weapon')}
                                        onClear={() => clearSlot('weapon')}
                                    />
                                </div>
                                <div>
                                    <p className="mb-2 flex items-center gap-2 text-[9px] font-black tracking-wider text-[#96c5df] uppercase">
                                        <Shield className="size-3" /> Armadura
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {(
                                            [
                                                'armor_head',
                                                'armor_body',
                                                'armor_legs',
                                            ] as SlotKey[]
                                        ).map((slot) => (
                                            <EquipmentSlot
                                                key={slot}
                                                slot={slot}
                                                item={loadout[slot]}
                                                onOpen={() => openSlot(slot)}
                                                onClear={() => clearSlot(slot)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="relative mt-7 border-t border-[#4f4268] pt-5">
                                <p className="mb-3 flex items-center gap-2 text-[9px] font-black tracking-wider text-[#dc79ae] uppercase">
                                    <Sparkles className="size-3" /> Acessórios e
                                    reforges
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                    {accessorySlots.map((slot) => (
                                        <div key={slot} className="min-w-0">
                                            <EquipmentSlot
                                                slot={slot}
                                                item={loadout[slot]}
                                                onOpen={() => openSlot(slot)}
                                                onClear={() => clearSlot(slot)}
                                            />
                                            <select
                                                aria-label={`Reforge de ${slotLabels[slot]}`}
                                                value={accessoryReforges[slot]}
                                                onChange={(event) =>
                                                    setAccessoryReforges(
                                                        (current) => ({
                                                            ...current,
                                                            [slot]: event.target
                                                                .value as ReforgeKey,
                                                        }),
                                                    )
                                                }
                                                className="mt-2 h-9 w-full rounded-md border border-[#4f4268] bg-[#171424] px-2 text-xs font-bold text-[#d9d2e5] outline-none focus:border-[#e8cf8b]"
                                            >
                                                {Object.entries(reforges).map(
                                                    ([key, reforge]) => (
                                                        <option
                                                            key={key}
                                                            value={key}
                                                        >
                                                            {reforge.name}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="h-fit rounded-xl border border-border bg-card p-5 xl:sticky xl:top-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[9px] font-black tracking-[0.18em] text-primary uppercase">
                                    Resultado
                                </p>
                                <h2 className="text-xl font-black">
                                    Valores da build
                                </h2>
                            </div>
                            <Calculator className="size-5 text-primary" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                label="Dano por hit"
                                value={formatNumber(totals.damage)}
                                note={`base ${formatNumber(totals.baseDamage)}`}
                            />
                            <StatCard
                                label="DPS estimado"
                                value={formatNumber(totals.dps)}
                                note={`${formatNumber(totals.attacksPerSecond)} ataques/s`}
                            />
                            <StatCard
                                label="Defesa"
                                value={formatNumber(totals.defense, 0)}
                            />
                            <StatCard
                                label="Crítico"
                                value={`${formatNumber(totals.critical)}%`}
                            />
                            <StatCard
                                label="Bônus de dano"
                                value={`+${formatNumber(totals.damagePercent)}%`}
                            />
                            <StatCard
                                label="Knockback"
                                value={formatNumber(totals.knockback)}
                            />
                            <StatCard
                                label="Custo de mana"
                                value={formatNumber(totals.mana, 0)}
                            />
                            <StatCard
                                label="Build completa"
                                value={`${totals.selected}/9`}
                            />
                        </div>
                        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
                            Cálculo baseado nos atributos normalizados do item e
                            nos reforges selecionados. Efeitos condicionais de
                            tooltip não entram no DPS estimado.
                        </p>
                    </aside>
                </div>

                <Dialog
                    open={activeSlot !== null}
                    onOpenChange={(open) => !open && setActiveSlot(null)}
                >
                    <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>
                                {activeSlot
                                    ? `Escolher ${slotLabels[activeSlot]}`
                                    : 'Escolher item'}
                            </DialogTitle>
                            <DialogDescription>
                                A lista já está filtrada para este slot do
                                inventário.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid shrink-0 gap-2 md:grid-cols-[minmax(0,1fr)_160px_170px_130px]">
                            <label className="relative block">
                                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Buscar pelo nome do item..."
                                    className="h-11 w-full rounded-md border border-input bg-background pr-10 pl-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                                {searching && (
                                    <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-primary" />
                                )}
                            </label>

                            <label className="relative">
                                <Filter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <select
                                    aria-label="Filtrar por origem"
                                    value={source}
                                    onChange={(event) => {
                                        setSource(
                                            event.target.value as ItemSource,
                                        );
                                        setPage(1);
                                    }}
                                    className="h-11 w-full appearance-none rounded-md border border-input bg-background pr-8 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="all">
                                        Todas as origens
                                    </option>
                                    <option value="vanilla">Vanilla</option>
                                    <option value="calamity">
                                        Calamity Mod
                                    </option>
                                </select>
                            </label>

                            <select
                                aria-label="Ordenar itens"
                                value={order}
                                onChange={(event) => {
                                    setOrder(event.target.value as ItemOrder);
                                    setPage(1);
                                }}
                                className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="name-asc">Nome: A–Z</option>
                                <option value="name-desc">Nome: Z–A</option>
                                <option value="rarity-asc">
                                    Raridade: crescente
                                </option>
                                <option value="rarity-desc">
                                    Raridade: decrescente
                                </option>
                            </select>

                            <select
                                aria-label="Itens por página"
                                value={pageSize}
                                onChange={(event) => {
                                    setPageSize(Number(event.target.value));
                                    setPage(1);
                                }}
                                className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value={12}>12 por página</option>
                                <option value={24}>24 por página</option>
                                <option value={48}>48 por página</option>
                            </select>
                        </div>

                        {error && (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </p>
                        )}

                        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pr-2 sm:grid-cols-3 lg:grid-cols-4">
                            {results.map((item) => (
                                <button
                                    key={item.global_id}
                                    type="button"
                                    onClick={() => chooseItem(item)}
                                    className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background/45 p-3 text-left transition hover:border-primary hover:bg-primary/5"
                                >
                                    <span className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-black/20 p-1">
                                        <ItemSprite
                                            item={item}
                                            displaySize={38}
                                        />
                                    </span>
                                    <span className="min-w-0">
                                        <strong className="block truncate text-xs">
                                            {item.display_name}
                                        </strong>
                                        <small className="block truncate text-[9px] text-muted-foreground">
                                            {item.mod_name ?? 'Terraria'}
                                        </small>
                                        {numericStat(item, 'damage') > 0 && (
                                            <small className="text-[9px] font-bold text-primary">
                                                {formatNumber(
                                                    numericStat(item, 'damage'),
                                                    0,
                                                )}{' '}
                                                dano
                                            </small>
                                        )}
                                        {numericStat(item, 'defense') > 0 && (
                                            <small className="text-[9px] font-bold text-[#84b7d5]">
                                                {formatNumber(
                                                    numericStat(
                                                        item,
                                                        'defense',
                                                    ),
                                                    0,
                                                )}{' '}
                                                defesa
                                            </small>
                                        )}
                                    </span>
                                </button>
                            ))}
                            {!searching && results.length === 0 && (
                                <div className="col-span-full grid min-h-36 place-items-center text-sm text-muted-foreground">
                                    Nenhum item encontrado para este slot.
                                </div>
                            )}
                        </div>

                        <footer className="flex shrink-0 flex-col gap-3 border-t border-border pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">
                                {pagination.total > 0 ? (
                                    <>
                                        Exibindo {pagination.from}–
                                        {pagination.to} de{' '}
                                        {pagination.total.toLocaleString(
                                            'pt-BR',
                                        )}{' '}
                                        itens
                                    </>
                                ) : (
                                    'Nenhum item encontrado'
                                )}
                            </p>
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((current) => current - 1)
                                    }
                                    disabled={
                                        searching ||
                                        pagination.current_page <= 1
                                    }
                                    className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-4" />
                                    Anterior
                                </button>
                                <span className="min-w-24 text-center text-xs font-medium">
                                    Página {pagination.current_page} de{' '}
                                    {pagination.last_page}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((current) => current + 1)
                                    }
                                    disabled={
                                        searching ||
                                        pagination.current_page >=
                                            pagination.last_page
                                    }
                                    className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Próxima
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </footer>
                    </DialogContent>
                </Dialog>
            </main>
        </>
    );
}

GameBuildPlanner.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Biblioteca', href: '/dashboard/biblioteca' },
        { title: 'Terraria', href: '/dashboard/biblioteca/terraria' },
        {
            title: 'Planner',
            href: '/dashboard/biblioteca/terraria/planner',
        },
    ],
};
