import { Head } from '@inertiajs/react';

type AdminDashboardProps = {
    stats: Record<'projects' | 'experiences' | 'skills' | 'messages', number>;
    messages: Array<{
        id: number;
        name: string;
        email: string;
        subject: string;
        status: string;
        created_at: string;
    }>;
};

export default function AdminDashboard({
    stats,
    messages,
}: AdminDashboardProps) {
    return (
        <>
            <Head title="Admin - Rechi OS" />
            <main className="min-h-screen bg-background p-8 font-mono text-foreground">
                <header className="mb-8">
                    <p className="text-[var(--asset-color-green)]">
                        &gt; admin unlocked
                    </p>
                    <h1 className="text-4xl font-black text-[var(--asset-color-cream)]">
                        RECHI OS CONTROL
                    </h1>
                </header>
                <section className="grid gap-4 md:grid-cols-4">
                    {Object.entries(stats).map(([label, value]) => (
                        <article
                            key={label}
                            className="rounded-lg border border-border bg-card p-5"
                        >
                            <p className="text-accent uppercase">{label}</p>
                            <strong className="mt-2 block text-3xl text-primary">
                                {value}
                            </strong>
                        </article>
                    ))}
                </section>
                <section className="mt-8 rounded-lg border border-border bg-card p-5">
                    <h2 className="mb-4 text-xl text-[var(--asset-color-cream)]">
                        Messages
                    </h2>
                    <div className="grid gap-3">
                        {messages.map((message) => (
                            <article
                                key={message.id}
                                className="rounded-md border border-border p-4"
                            >
                                <strong>{message.subject}</strong>
                                <p className="text-sm text-muted-foreground">
                                    {message.name} - {message.email} -{' '}
                                    {message.status}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}
