import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Gamepad2, Library } from 'lucide-react';

const games = [
    {
        name: 'Terraria',
        description:
            'Consulte itens e explore builds de progressão para todas as classes e subclasses.',
        href: '/dashboard/biblioteca/terraria',
        logo: '/images/games/terraria-logo.png',
        details: 'Vanilla + Calamity Mod',
    },
];

export default function GameLibraryIndex() {
    return (
        <>
            <Head title="Biblioteca" />
            <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
                <header className="overflow-hidden rounded-xl border border-border bg-card p-5 md:p-7">
                    <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
                        <Library className="size-4" /> Rechi OS
                    </p>
                    <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                        Biblioteca
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                        Escolha um jogo para acessar seus itens, builds e guias
                        de progressão.
                    </p>
                </header>

                <section aria-labelledby="games-title">
                    <div className="mb-4 flex items-center gap-2">
                        <Gamepad2 className="size-5 text-primary" />
                        <h2 id="games-title" className="text-lg font-bold">
                            Jogos
                        </h2>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {games.map((game) => (
                            <Link
                                key={game.name}
                                href={game.href}
                                prefetch
                                className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <div className="relative grid min-h-52 place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(74,222,128,0.3),transparent_48%),linear-gradient(180deg,#172b24_0%,#111827_58%,#0b1020_100%)] p-8">
                                    <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
                                    <img
                                        src={game.logo}
                                        alt={`Logo de ${game.name}`}
                                        className="relative max-h-28 w-full max-w-80 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)] transition duration-200 group-hover:scale-105"
                                    />
                                </div>

                                <div className="flex items-end justify-between gap-4 p-5">
                                    <div>
                                        <p className="text-xs font-bold tracking-wider text-primary uppercase">
                                            {game.details}
                                        </p>
                                        <h3 className="mt-1 text-xl font-black">
                                            {game.name}
                                        </h3>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            {game.description}
                                        </p>
                                    </div>
                                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-background transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                                        <ArrowRight className="size-5" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}

GameLibraryIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Biblioteca', href: '/dashboard/biblioteca' },
    ],
};
