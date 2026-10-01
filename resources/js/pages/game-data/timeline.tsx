import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    Boxes,
    ChevronRight,
    Gem,
    LoaderCircle,
    Search,
    Shield,
    SlidersHorizontal,
    Sparkles,
    Sword,
    Swords,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

type IconAsset = {
    url: string;
    width?: number;
    height?: number;
    mime_type?: string;
    metadata_json?: {
        frame_count?: number;
        frame_height?: number;
    } | null;
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
    dynamic_score?: number;
    reforge?: {
        key: string;
        name: string;
        defense_bonus: number;
        damage_percent: number;
        critical_chance_percent: number;
    } | null;
    item: ItemSummary | null;
};

type BuildLoadout = {
    weapon: PlannerItem | null;
    armor: {
        head: PlannerItem | null;
        body: PlannerItem | null;
        legs: PlannerItem | null;
        other: PlannerItem[];
    };
    accessories: PlannerItem[];
    missing_slots: string[];
    completion: number;
    total_slots: number;
};

type TimelineStep = {
    id: number;
    title: string;
    milestone_name: string;
    milestone_description?: string | null;
    milestone_type?: string;
    progression_value?: number | string | null;
    items: PlannerItem[];
    build: BuildLoadout;
};

type Planner = {
    planner_key: string;
    name: string;
    description?: string | null;
    archetype_name: string;
    status: string;
    version: string;
    balance: number;
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

type ItemDetail = {
    item: ItemSummary &
        Record<string, unknown> & {
            game_version?: string;
            mod_version?: string | null;
        };
    icon?: IconAsset | null;
    stats_map: Record<
        string,
        { value: number | string | null; unit?: string | null }
    >;
    categories: Array<{ name: string }>;
    combat_classes: Array<{ name: string }>;
    tags: Array<{ name: string }>;
    properties: Array<Record<string, unknown>>;
    progression: Array<Record<string, unknown>>;
    drops: Array<Record<string, unknown>>;
    recipes: Array<Record<string, unknown>>;
    used_in_recipes: Array<Record<string, unknown>>;
    acquisition_methods: Array<Record<string, unknown>>;
    shops: Array<Record<string, unknown>>;
    relationships: Array<Record<string, unknown>>;
    related_from: Array<Record<string, unknown>>;
    sources: Array<Record<string, unknown>>;
    completeness?: Record<string, unknown>;
    unlocked_when: Array<Record<string, unknown>>;
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

function formatLabel(value: string): string {
    return value.replaceAll('_', ' ');
}

function formatStatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const numeric =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
              ? Number(value)
              : null;

    if (numeric !== null && Number.isFinite(numeric)) {
        return numeric.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    return String(value);
}

function formatDetailValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (typeof value === 'boolean') {
        return value ? 'Sim' : 'Não';
    }

    if (typeof value === 'number') {
        return formatStatValue(value);
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}

function recordTitle(record: Record<string, unknown>, index: number): string {
    for (const key of [
        'display_name',
        'item_name',
        'result_name',
        'npc_name',
        'source_item_name',
        'vendor_name',
        'name',
        'global_id',
        'method_type',
    ]) {
        if (record[key]) {
            return String(record[key]);
        }
    }

    return `Registro ${index + 1}`;
}

function DetailRecords({
    title,
    records,
}: {
    title: string;
    records: Array<Record<string, unknown>>;
}) {
    if (records.length === 0) {
        return null;
    }

    return (
        <section>
            <h3 className="mb-3 text-sm font-black tracking-wider text-[#e8cf8b] uppercase">
                {title}{' '}
                <span className="text-[#81768f]">({records.length})</span>
            </h3>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                {records.map((record, index) => (
                    <article
                        key={`${title}-${index}-${String(record.global_id ?? record.id ?? '')}`}
                        className="min-w-0 overflow-hidden rounded-lg border border-[#4b405f] bg-[#171424] p-3"
                    >
                        <strong className="block text-sm [overflow-wrap:anywhere] break-words text-[#fff8dc]">
                            {recordTitle(record, index)}
                        </strong>
                        <dl className="mt-2 grid gap-1.5 text-xs">
                            {Object.entries(record).map(([key, value]) => (
                                <div
                                    key={key}
                                    className="grid min-w-0 grid-cols-1 gap-1 border-t border-white/5 pt-1.5 sm:grid-cols-[minmax(90px,0.35fr)_minmax(0,1fr)] sm:gap-2"
                                >
                                    <dt className="truncate font-bold text-[#81768f] uppercase">
                                        {formatLabel(key)}
                                    </dt>
                                    <dd className="min-w-0 [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-[#c9c1d7]">
                                        {formatDetailValue(value)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </article>
                ))}
            </div>
        </section>
    );
}

function UnlockRequirements({
    records,
}: {
    records: Array<Record<string, unknown>>;
}) {
    if (records.length === 0) {
        return null;
    }

    return (
        <section>
            <h3 className="mb-3 text-sm font-black tracking-wider text-[#e8cf8b] uppercase">
                Desbloqueado quando
            </h3>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                {records.map((record, index) => {
                    const conditions = Array.isArray(record.conditions)
                        ? (record.conditions as Array<Record<string, unknown>>)
                        : [];

                    return (
                        <article
                            key={`${String(record.method_key ?? index)}`}
                            className="min-w-0 overflow-hidden rounded-lg border border-[#6f5832] bg-[#171424] p-4"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <strong className="text-sm [overflow-wrap:anywhere] break-words text-[#fff8dc]">
                                    {String(record.label ?? 'Desbloquear item')}
                                </strong>
                                <span className="rounded border border-[#d7a84b]/30 bg-[#d7a84b]/10 px-2 py-1 text-[9px] font-black tracking-wider text-[#e8cf8b] uppercase">
                                    {formatLabel(
                                        String(record.method_type ?? 'unknown'),
                                    )}
                                </span>
                            </div>
                            {conditions.length > 0 && (
                                <ul className="mt-3 grid gap-2">
                                    {conditions.map(
                                        (condition, conditionIndex) => (
                                            <li
                                                key={`${String(condition.condition_type ?? '')}-${conditionIndex}`}
                                                className="flex min-w-0 gap-2 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-[#c9c1d7]"
                                            >
                                                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#d7a84b]" />
                                                {String(
                                                    condition.label ??
                                                        'Cumprir a condição',
                                                )}
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
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
        return <Boxes className="size-5 text-muted-foreground" />;
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
                loading="lazy"
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
    const renderedWidth = sourceWidth * scale;
    const renderedFrameHeight = frameHeight * scale;

    return (
        <span
            className="block overflow-hidden"
            style={{ width: renderedWidth, height: renderedFrameHeight }}
        >
            <img
                src={icon.url}
                alt=""
                className="block max-w-none [image-rendering:pixelated]"
                style={{
                    width: renderedWidth,
                    height: sourceHeight * scale,
                }}
                loading="lazy"
            />
        </span>
    );
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
            <ItemSprite item={item} displaySize={size === 'sm' ? 28 : 40} />
        </div>
    );
}

function BuildSlot({
    label,
    recommendation,
    onSelect,
    accent = false,
}: {
    label: string;
    recommendation: PlannerItem | null;
    onSelect: (globalId: string) => void;
    accent?: boolean;
}) {
    const item = recommendation?.item ?? null;
    const stats = Object.entries(item?.stats ?? {});

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    disabled={!item}
                    onClick={() => item && onSelect(item.global_id)}
                    className={`group flex min-h-16 min-w-0 items-center gap-2 rounded-md border-2 p-2 text-left shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] transition ${
                        accent
                            ? 'border-[#d7a84b] bg-[#2f284e] hover:bg-[#3a315e]'
                            : 'border-[#5f527a] bg-[#211d38] hover:border-[#9a83c5] hover:bg-[#2b2547]'
                    } disabled:cursor-default disabled:border-[#3a344d] disabled:bg-[#171522]`}
                >
                    <span className="grid size-12 shrink-0 place-items-center rounded border border-white/10 bg-[#0e0d18]/80 p-1">
                        {item ? (
                            <ItemSprite item={item} displaySize={40} />
                        ) : (
                            <span className="size-5 rounded border border-dashed border-white/20" />
                        )}
                    </span>
                    <span className="min-w-0">
                        <small className="block text-[9px] font-black tracking-[0.14em] text-[#d6bc79] uppercase">
                            {label}
                        </small>
                        <strong className="block truncate text-xs text-[#fff8dc]">
                            {item?.display_name ?? 'Slot vazio'}
                        </strong>
                        {item && (
                            <small className="block truncate text-[10px] text-[#aaa1bd]">
                                {recommendation?.reforge ? (
                                    <>
                                        <span className="font-bold text-[#7fd6a4]">
                                            {recommendation.reforge.name}
                                        </span>{' '}
                                        · {item.mod_name}
                                    </>
                                ) : (
                                    item.mod_name
                                )}
                            </small>
                        )}
                    </span>
                </button>
            </TooltipTrigger>
            {item && (
                <TooltipContent
                    side="top"
                    className="w-64 border border-[#79649a] bg-[#171424] p-3 text-[#fff8dc] shadow-2xl"
                >
                    <strong className="block text-sm">
                        {item.display_name}
                    </strong>
                    {recommendation?.reforge && (
                        <p className="mt-1 text-xs font-bold text-[#7fd6a4]">
                            Reforge: {recommendation.reforge.name}
                            {recommendation.reforge.defense_bonus > 0 &&
                                ` (+${recommendation.reforge.defense_bonus} defesa)`}
                            {recommendation.reforge.damage_percent > 0 &&
                                ` (+${recommendation.reforge.damage_percent}% dano)`}
                            {recommendation.reforge.critical_chance_percent >
                                0 &&
                                ` (+${recommendation.reforge.critical_chance_percent}% crítico)`}
                        </p>
                    )}
                    {stats.length > 0 && (
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-2">
                            {stats.map(([key, value]) => (
                                <div key={key} className="contents">
                                    <dt className="text-[#aaa1bd] uppercase">
                                        {formatLabel(key)}
                                    </dt>
                                    <dd className="text-right font-bold text-[#e8cf8b]">
                                        {formatStatValue(value)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    )}
                    {(item.tooltip || item.description) && (
                        <p className="mt-2 border-t border-white/10 pt-2 leading-relaxed text-[#c9c1d7]">
                            {item.tooltip || item.description}
                        </p>
                    )}
                </TooltipContent>
            )}
        </Tooltip>
    );
}

function GameBuildCard({
    step,
    onSelect,
}: {
    step: TimelineStep;
    onSelect: (globalId: string) => void;
}) {
    const accessories = Array.from<PlannerItem | null>({ length: 5 }).map(
        (_, index) => step.build.accessories[index] ?? null,
    );

    return (
        <article className="overflow-hidden rounded-xl border-2 border-[#6f5832] bg-[#141221] shadow-[0_18px_45px_rgb(0_0_0/0.42),inset_0_0_35px_rgb(91_68_130/0.18)]">
            <div className="flex items-center justify-between gap-3 border-b-2 border-[#6f5832] bg-[linear-gradient(180deg,#443865,#2a2444)] px-4 py-3">
                <div className="min-w-0">
                    <p className="text-[9px] font-black tracking-[0.2em] text-[#d7a84b] uppercase">
                        Loadout recomendado
                    </p>
                    <h3 className="truncate text-sm font-black text-[#fff8dc]">
                        {step.title || step.milestone_name}
                    </h3>
                </div>
                <span className="shrink-0 rounded border border-[#d7a84b]/50 bg-black/20 px-2 py-1 text-[10px] font-bold text-[#e8cf8b]">
                    {step.build.completion}/{step.build.total_slots} slots
                </span>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-wider text-[#b9a9d4] uppercase">
                        <Sword className="size-3.5 text-[#d7a84b]" /> Arma
                        principal
                    </p>
                    <BuildSlot
                        label="Arma"
                        recommendation={step.build.weapon}
                        onSelect={onSelect}
                        accent
                    />
                    {step.build.weapon?.item?.stats?.damage != null && (
                        <p className="mt-2 text-[10px] text-[#aaa1bd]">
                            Dano base:{' '}
                            <strong className="text-[#fff8dc]">
                                {formatStatValue(
                                    step.build.weapon.item.stats.damage,
                                )}
                            </strong>
                        </p>
                    )}
                </div>

                <div>
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-wider text-[#b9a9d4] uppercase">
                        <Shield className="size-3.5 text-[#84b7d5]" /> Armadura
                    </p>
                    <div className="grid gap-2">
                        <BuildSlot
                            label="Capacete"
                            recommendation={step.build.armor.head}
                            onSelect={onSelect}
                        />
                        <BuildSlot
                            label="Peitoral"
                            recommendation={step.build.armor.body}
                            onSelect={onSelect}
                        />
                        <BuildSlot
                            label="Pernas"
                            recommendation={step.build.armor.legs}
                            onSelect={onSelect}
                        />
                    </div>
                </div>
            </div>

            <div className="border-t border-[#4b405f] bg-[#0e0d18]/55 p-4">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-wider text-[#b9a9d4] uppercase">
                    <Gem className="size-3.5 text-[#dc79a5]" /> Acessórios
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {accessories.map((accessory, index) => (
                        <BuildSlot
                            key={accessory?.id ?? `empty-accessory-${index}`}
                            label={`Slot ${index + 1}`}
                            recommendation={accessory}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            </div>
        </article>
    );
}

function ItemDetailDialog({
    detail,
    onClose,
}: {
    detail: ItemDetail | null;
    onClose: () => void;
}) {
    const item = detail?.item;

    return (
        <Dialog
            open={detail !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none min-w-0 flex-col gap-0 overflow-hidden border-[#6f5832] bg-[#0d0c16] p-0 text-[#fff8dc] sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-[1200px]">
                {detail && item && (
                    <>
                        <DialogHeader className="min-w-0 border-b border-[#4b405f] bg-[linear-gradient(180deg,#302744,#171424)] p-4 pr-12 text-left sm:p-5 sm:pr-14">
                            <div className="flex items-start gap-4">
                                <ItemIcon
                                    item={{ ...item, icon: detail.icon }}
                                />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black tracking-[0.18em] text-[#d7a84b] uppercase">
                                        {item.mod_name ?? 'Terraria'}
                                    </p>
                                    <DialogTitle className="mt-1 text-xl font-black [overflow-wrap:anywhere] break-words text-[#fff8dc] sm:text-2xl">
                                        {item.display_name}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 text-xs break-all text-[#aaa1bd]">
                                        {item.global_id}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="min-w-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:space-y-7 md:p-7">
                            {(item.tooltip || item.description) && (
                                <p className="max-w-5xl rounded-lg border border-[#4b405f] bg-[#171424] p-4 text-sm leading-relaxed [overflow-wrap:anywhere] break-words text-[#c9c1d7]">
                                    {item.tooltip || item.description}
                                </p>
                            )}

                            <section>
                                <h3 className="mb-3 text-sm font-black tracking-wider text-[#e8cf8b] uppercase">
                                    Status
                                </h3>
                                <div className="grid min-w-0 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                                    {Object.entries(detail.stats_map).map(
                                        ([key, stat]) => (
                                            <div
                                                key={key}
                                                className="min-w-0 overflow-hidden rounded-lg border border-[#4b405f] bg-[#171424] p-3"
                                            >
                                                <small className="block text-[10px] font-bold text-[#81768f] uppercase">
                                                    {formatLabel(key)}
                                                </small>
                                                <strong className="mt-1 block text-sm [overflow-wrap:anywhere] break-words text-[#fff8dc]">
                                                    {formatStatValue(
                                                        stat.value,
                                                    )}{' '}
                                                    {stat.unit ?? ''}
                                                </strong>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </section>

                            <section>
                                <h3 className="mb-3 text-sm font-black tracking-wider text-[#e8cf8b] uppercase">
                                    Classificação
                                </h3>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {detail.combat_classes.map((entry) => (
                                        <span
                                            key={`class-${entry.name}`}
                                            className="max-w-full rounded-full border border-[#d7a84b]/35 bg-[#d7a84b]/10 px-3 py-1 [overflow-wrap:anywhere] break-words text-[#e8cf8b]"
                                        >
                                            <Swords className="mr-1 inline size-3" />
                                            {entry.name}
                                        </span>
                                    ))}
                                    {detail.categories.map((entry) => (
                                        <span
                                            key={`category-${entry.name}`}
                                            className="max-w-full rounded-full border border-[#79649a]/50 bg-[#302744] px-3 py-1 [overflow-wrap:anywhere] break-words text-[#c9c1d7]"
                                        >
                                            <Shield className="mr-1 inline size-3" />
                                            {entry.name}
                                        </span>
                                    ))}
                                    {detail.tags.map((entry) => (
                                        <span
                                            key={`tag-${entry.name}`}
                                            className="max-w-full rounded-full border border-[#4b405f] bg-[#171424] px-3 py-1 [overflow-wrap:anywhere] break-words text-[#aaa1bd]"
                                        >
                                            {entry.name}
                                        </span>
                                    ))}
                                </div>
                            </section>

                            <DetailRecords
                                title="Identificação e metadados"
                                records={[item]}
                            />
                            <DetailRecords
                                title="Propriedades"
                                records={detail.properties}
                            />
                            <DetailRecords
                                title="Progressão"
                                records={detail.progression}
                            />
                            <DetailRecords
                                title="Receitas para criar"
                                records={detail.recipes}
                            />
                            <DetailRecords
                                title="Usado em receitas"
                                records={detail.used_in_recipes}
                            />
                            <DetailRecords
                                title="Drops"
                                records={detail.drops}
                            />
                            <UnlockRequirements
                                records={detail.unlocked_when}
                            />
                            <DetailRecords
                                title="Formas de obtenção"
                                records={detail.acquisition_methods}
                            />
                            <DetailRecords
                                title="Lojas"
                                records={detail.shops}
                            />
                            <DetailRecords
                                title="Relacionamentos"
                                records={detail.relationships}
                            />
                            <DetailRecords
                                title="Relacionado por"
                                records={detail.related_from}
                            />
                            <DetailRecords
                                title="Fontes dos dados"
                                records={detail.sources}
                            />
                            <DetailRecords
                                title="Disponibilidade no planner"
                                records={detail.planner?.availability ?? []}
                            />
                            <DetailRecords
                                title="Recomendações do planner"
                                records={detail.planner?.recommendations ?? []}
                            />
                            {detail.completeness && (
                                <DetailRecords
                                    title="Qualidade dos dados"
                                    records={[detail.completeness]}
                                />
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default function GameDataTimeline() {
    const [archetypes, setArchetypes] = useState<Archetype[]>([]);
    const [planners, setPlanners] = useState<PlannerSummary[]>([]);
    const [selectedPlannerKey, setSelectedPlannerKey] = useState('');
    const [planner, setPlanner] = useState<Planner | null>(null);
    const [loadingPlanner, setLoadingPlanner] = useState(false);
    const [balance, setBalance] = useState(0);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ItemSummary[]>([]);
    const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const plannerRequest = useRef(0);

    const loadPlanner = useCallback(
        async (plannerKey: string, balanceValue: number) => {
            if (!plannerKey) {
                return;
            }

            const requestId = ++plannerRequest.current;
            setLoadingPlanner(true);
            setError(null);

            try {
                const nextPlanner = await getJson<Planner>(
                    `/dashboard/game-data/planners/${encodeURIComponent(plannerKey)}?balance=${balanceValue}`,
                );
                if (requestId === plannerRequest.current) {
                    setPlanner(nextPlanner);
                }
            } catch (reason) {
                if (requestId === plannerRequest.current) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Falha ao carregar o planner.',
                    );
                }
            } finally {
                if (requestId === plannerRequest.current) {
                    setLoadingPlanner(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        let active = true;
        Promise.all([
            getJson<Archetype[]>('/dashboard/game-data/classes'),
            getJson<PlannerSummary[]>(
                '/dashboard/game-data/planners?status=published',
            ),
        ])
            .then(([archetypeData, plannerData]) => {
                if (!active) {
                    return;
                }

                setArchetypes(archetypeData);
                setPlanners(plannerData);
                const first = plannerData[0]?.planner_key ?? '';
                setSelectedPlannerKey(first);
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

    useEffect(() => {
        if (!selectedPlannerKey) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void loadPlanner(selectedPlannerKey, balance);
        }, 120);

        return () => window.clearTimeout(timeout);
    }, [balance, loadPlanner, selectedPlannerKey]);

    const classGroups = useMemo(() => {
        const roots = archetypes.filter((entry) => entry.kind === 'class');

        return roots.map((root) => ({
            ...root,
            subclasses: archetypes.filter(
                (entry) => entry.parent_key === root.archetype_key,
            ),
        }));
    }, [archetypes]);
    const balanceLabel =
        balance <= -34 ? 'Defensivo' : balance >= 34 ? 'Dano' : 'Balanceado';

    function selectPlanner(plannerKey: string) {
        setSelectedPlannerKey(plannerKey);
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
            <Head title="Timeline | Terraria" />
            <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6">
                <header className="overflow-hidden rounded-xl border border-border bg-card p-5 md:p-7">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                        <div>
                            <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
                                <Sparkles className="size-4" /> Rechi OS / Game
                                Data
                            </p>
                            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                                Timeline de progressão
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

                <section className="rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 items-start gap-3 lg:w-72">
                            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                <SlidersHorizontal className="size-5" />
                            </span>
                            <div>
                                <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                    Perfil da build
                                </p>
                                <strong className="text-lg">
                                    {balanceLabel}
                                </strong>
                                <p className="text-xs text-muted-foreground">
                                    Equipamentos e reforges são recalculados ao
                                    arrastar.
                                </p>
                            </div>
                        </div>

                        <div className="min-w-0 flex-1">
                            <input
                                aria-label="Equilíbrio entre defesa e dano"
                                type="range"
                                min={-100}
                                max={100}
                                step={1}
                                value={balance}
                                onChange={(event) =>
                                    setBalance(Number(event.target.value))
                                }
                                className="h-2 w-full cursor-grab accent-primary active:cursor-grabbing"
                            />
                            <div className="mt-2 grid grid-cols-3 text-[10px] font-black tracking-wider uppercase">
                                <button
                                    type="button"
                                    onClick={() => setBalance(-100)}
                                    className="text-left text-[#84b7d5]"
                                >
                                    Defesa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBalance(0)}
                                    className="text-center text-[#e8cf8b]"
                                >
                                    Balanceado
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBalance(100)}
                                    className="text-right text-[#dc7979]"
                                >
                                    Dano
                                </button>
                            </div>
                        </div>

                        <div className="w-16 text-right font-mono text-sm font-bold text-primary">
                            {balance > 0 ? '+' : ''}
                            {balance}
                            {loadingPlanner && (
                                <LoaderCircle className="mt-1 ml-auto size-4 animate-spin" />
                            )}
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                        <AlertCircle className="size-5 text-destructive" />{' '}
                        {error}
                    </div>
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

                    <section className="relative min-w-0 overflow-hidden rounded-xl border border-[#4f4268] bg-[#0d0c16] p-4 md:p-6">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(83_61_120/0.28),transparent_42%),linear-gradient(rgb(255_255_255/0.018)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.018)_1px,transparent_1px)] bg-[size:auto,16px_16px,16px_16px]" />
                        {loadingPlanner && !planner ? (
                            <div className="relative grid min-h-64 place-items-center">
                                <LoaderCircle className="size-8 animate-spin text-primary" />
                            </div>
                        ) : planner ? (
                            <div className="relative">
                                <div className="mb-8 rounded-lg border border-[#64537f] bg-[#171424]/90 p-4 shadow-lg">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="rounded border border-[#d7a84b]/40 bg-[#d7a84b]/10 px-2 py-1 font-black text-[#e9c76f]">
                                            {planner.archetype_name}
                                        </span>
                                        <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[#aaa1bd]">
                                            v{planner.version}
                                        </span>
                                        <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[#aaa1bd]">
                                            {planner.timeline.length} fases
                                        </span>
                                    </div>
                                    <h2 className="mt-3 text-2xl font-black text-[#fff8dc]">
                                        {planner.name}
                                    </h2>
                                    {planner.description && (
                                        <p className="mt-2 text-sm text-[#aaa1bd]">
                                            {planner.description}
                                        </p>
                                    )}
                                </div>
                                <ol className="relative grid gap-10 before:absolute before:top-3 before:bottom-3 before:left-5 before:w-1 before:rounded-full before:bg-[linear-gradient(#6c5790,#d7a84b,#6c5790)] lg:before:left-1/2 lg:before:-translate-x-1/2">
                                    {planner.timeline.map((step, index) => {
                                        const cardSide =
                                            index % 2 === 0
                                                ? 'lg:col-start-1'
                                                : 'lg:col-start-3';
                                        const infoSide =
                                            index % 2 === 0
                                                ? 'lg:col-start-3 lg:text-left'
                                                : 'lg:col-start-1 lg:row-start-1 lg:text-right';

                                        return (
                                            <li
                                                key={step.id}
                                                className="relative grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-x-4 lg:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] lg:gap-x-5"
                                            >
                                                <div
                                                    className={`col-start-2 min-w-0 ${cardSide}`}
                                                >
                                                    <GameBuildCard
                                                        step={step}
                                                        onSelect={(globalId) =>
                                                            void inspectItem(
                                                                globalId,
                                                            )
                                                        }
                                                    />
                                                </div>

                                                <div className="absolute top-5 left-0 z-10 grid size-10 place-items-center rounded-full border-4 border-[#d7a84b] bg-[#292141] text-sm font-black text-[#fff8dc] shadow-[0_0_22px_rgb(215_168_75/0.55)] lg:static lg:col-start-2 lg:row-start-1 lg:mx-auto">
                                                    {index + 1}
                                                </div>

                                                <div
                                                    className={`col-start-2 mt-3 self-start rounded-lg border border-[#4b405f] bg-[#171424]/80 p-4 lg:row-start-1 lg:mt-2 ${infoSide}`}
                                                >
                                                    <p className="text-[9px] font-black tracking-[0.2em] text-[#d7a84b] uppercase">
                                                        {step.milestone_type ===
                                                        'event'
                                                            ? 'Evento'
                                                            : step.milestone_type ===
                                                                'miniboss'
                                                              ? 'Miniboss'
                                                              : 'Boss Checklist'}
                                                    </p>
                                                    <h3 className="mt-1 font-black text-[#fff8dc]">
                                                        {step.milestone_name}
                                                    </h3>
                                                    {step.progression_value !=
                                                        null && (
                                                        <span className="mt-1 inline-block rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-[#aaa1bd]">
                                                            ordem{' '}
                                                            {String(
                                                                step.progression_value,
                                                            )}
                                                        </span>
                                                    )}
                                                    {step.milestone_description && (
                                                        <p className="mt-2 text-xs leading-relaxed text-[#aaa1bd]">
                                                            {
                                                                step.milestone_description
                                                            }
                                                        </p>
                                                    )}
                                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35">
                                                        <div
                                                            className="h-full rounded-full bg-[linear-gradient(90deg,#7e6aa2,#d7a84b)]"
                                                            style={{
                                                                width: `${Math.round((step.build.completion / step.build.total_slots) * 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <small className="mt-1 block text-[9px] text-[#81768f]">
                                                        Build{' '}
                                                        {step.build
                                                            .completion ===
                                                        step.build.total_slots
                                                            ? 'completa'
                                                            : 'em formação'}
                                                    </small>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>
                        ) : (
                            <div className="relative grid min-h-64 place-items-center text-muted-foreground">
                                Nenhum planner publicado.
                            </div>
                        )}
                    </section>
                </div>

                <ItemDetailDialog
                    detail={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            </main>
        </>
    );
}

GameDataTimeline.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Biblioteca', href: '/dashboard/biblioteca' },
        { title: 'Terraria', href: '/dashboard/biblioteca/terraria' },
        {
            title: 'Timeline',
            href: '/dashboard/biblioteca/terraria/timeline',
        },
    ],
};
