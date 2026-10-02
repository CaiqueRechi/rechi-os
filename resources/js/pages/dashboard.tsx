import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Gamepad2,
    Palette,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { dashboard } from '@/routes';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import type { Auth } from '@/types';

export default function Dashboard() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const firstName = auth.user.name.trim().split(/\s+/)[0];

    const quickLinks = [
        ...(auth.screen_access?.can_open_library
            ? [
                  {
                      title: 'Biblioteca',
                      description:
                          'Acesse planners, timelines e bases de dados dos jogos.',
                      href: '/dashboard/biblioteca',
                      icon: BookOpen,
                  },
                  {
                      title: 'Terraria',
                      description:
                          'Continue montando builds e explorando a progressão.',
                      href: '/dashboard/biblioteca/terraria',
                      icon: Gamepad2,
                  },
              ]
            : []),
        {
            title: 'Meu perfil',
            description: 'Atualize seus dados pessoais e opções de segurança.',
            href: editProfile(),
            icon: UserRound,
        },
        {
            title: 'Aparência',
            description: 'Escolha como o dashboard deve aparecer para você.',
            href: editAppearance(),
            icon: Palette,
        },
    ];

    return (
        <>
            <Head title="Dashboard" />
            <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
                <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-semibold text-primary">
                            Visão geral
                        </p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                            Olá, {firstName}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Acesse suas ferramentas e configurações em um só
                            lugar.
                        </p>
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Sessão ativa
                    </div>
                </header>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-xl border border-border bg-card p-5 shadow-xs">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Conta
                                </p>
                                <strong className="mt-2 block text-xl">
                                    {auth.user.is_admin
                                        ? 'Administrador'
                                        : 'Usuário'}
                                </strong>
                            </div>
                            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                                <ShieldCheck className="size-5" />
                            </span>
                        </div>
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                            Acesso autenticado
                        </p>
                    </article>

                    <article className="rounded-xl border border-border bg-card p-5 shadow-xs">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Interface
                                </p>
                                <strong className="mt-2 block text-xl">
                                    Personalizável
                                </strong>
                            </div>
                            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                                <Palette className="size-5" />
                            </span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Modos claro e escuro disponíveis
                        </p>
                    </article>

                    <article className="rounded-xl border border-border bg-card p-5 shadow-xs sm:col-span-2 xl:col-span-1">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    Área de trabalho
                                </p>
                                <strong className="mt-2 block text-xl">
                                    Rechi Dashboard
                                </strong>
                            </div>
                            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                                <BookOpen className="size-5" />
                            </span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Ferramentas organizadas por módulo
                        </p>
                    </article>
                </section>

                <section>
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold">Acesso rápido</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Continue de onde parou ou ajuste sua conta.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {quickLinks.map(
                            ({ title, description, href, icon: Icon }) => (
                                <Link
                                    key={title}
                                    href={href}
                                    prefetch
                                    className="group flex min-h-44 flex-col rounded-xl border border-border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    <span className="grid size-10 place-items-center rounded-lg bg-muted text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                        <Icon className="size-5" />
                                    </span>
                                    <h3 className="mt-5 font-semibold">
                                        {title}
                                    </h3>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                        {description}
                                    </p>
                                    <ArrowRight className="mt-auto size-4 self-end text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                                </Link>
                            ),
                        )}
                    </div>
                </section>
            </main>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
