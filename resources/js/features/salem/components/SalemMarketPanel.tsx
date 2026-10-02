import { Link } from '@inertiajs/react';
import { ArrowLeft, Coins, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';

import type { SalemMarketItem } from '@/types';

type SalemMarketPanelProps = {
    open: boolean;
    items: SalemMarketItem[];
    balance: number;
    canWrite: boolean;
    busyItemId: number | null;
    message: string | null;
    onClose: () => void;
    onTrade: (item: SalemMarketItem, action: 'buy' | 'sell') => void;
};

export function SalemMarketPanel({
    open,
    items,
    balance,
    canWrite,
    busyItemId,
    message,
    onClose,
    onTrade,
}: SalemMarketPanelProps) {
    const [inventoryOnly, setInventoryOnly] = useState(false);
    const visibleItems = inventoryOnly
        ? items.filter((item) => item.owned > 0)
        : items;

    return (
        <aside
            aria-hidden={!open}
            className={`absolute inset-x-3 top-3 bottom-3 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/25 bg-[#101827]/92 text-white shadow-2xl shadow-slate-950/50 backdrop-blur-xl transition duration-300 sm:inset-x-auto sm:right-4 sm:w-[25rem] ${open ? 'translate-y-0 opacity-100 sm:translate-x-0' : 'pointer-events-none translate-y-8 opacity-0 sm:translate-x-[110%] sm:translate-y-0'}`}
        >
            <header className="border-b border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[0.65rem] font-bold tracking-[0.2em] text-amber-200 uppercase">
                            Mercado das ilhas
                        </p>
                        <h2 className="mt-1 flex items-center gap-2 text-xl font-bold">
                            <ShoppingBag className="size-5" /> Compra e venda
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid size-9 place-items-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                        aria-label="Fechar mercado"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-amber-50/80">
                        <Coins className="size-4 text-amber-300" /> Saldo
                    </span>
                    <strong className="text-amber-200">{balance} CP</strong>
                </div>

                {!canWrite ? (
                    <p className="mt-3 rounded-lg border border-sky-200/20 bg-sky-200/10 px-3 py-2 text-xs text-sky-100">
                        Seu acesso é somente leitura. Você pode consultar os
                        itens, mas não pode comprar ou vender.
                    </p>
                ) : null}

                {message ? (
                    <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                        {message}
                    </p>
                ) : null}
            </header>

            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs">
                <button
                    type="button"
                    onClick={() => setInventoryOnly(false)}
                    className={`rounded-full px-3 py-1.5 ${!inventoryOnly ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                >
                    Todos
                </button>
                <button
                    type="button"
                    onClick={() => setInventoryOnly(true)}
                    className={`rounded-full px-3 py-1.5 ${inventoryOnly ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                >
                    Meu inventário
                </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {visibleItems.map((item) => {
                    const busy = busyItemId === item.id;

                    return (
                        <article
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold">
                                        {item.name}
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                                        {item.description}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-semibold text-white/75">
                                    {item.owned} no inventário
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    disabled={
                                        !canWrite ||
                                        busy ||
                                        item.buy_price === null ||
                                        balance < (item.buy_price ?? 0)
                                    }
                                    onClick={() => onTrade(item, 'buy')}
                                    className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    <Plus className="size-3.5" /> Comprar
                                    {item.buy_price !== null
                                        ? ` ${item.buy_price} CP`
                                        : ''}
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        !canWrite ||
                                        busy ||
                                        item.sell_price === null ||
                                        item.owned < 1
                                    }
                                    onClick={() => onTrade(item, 'sell')}
                                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    <Minus className="size-3.5" /> Vender
                                    {item.sell_price !== null
                                        ? ` ${item.sell_price} CP`
                                        : ''}
                                </button>
                            </div>
                        </article>
                    );
                })}

                {visibleItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/55">
                        Nenhum item encontrado nesta lista.
                    </div>
                ) : null}
            </div>

            <footer className="border-t border-white/10 p-4">
                <Link
                    href="/dashboard/biblioteca"
                    className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                >
                    <ArrowLeft className="size-4" /> Voltar para a biblioteca
                </Link>
            </footer>
        </aside>
    );
}
