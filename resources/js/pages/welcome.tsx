import { Head, router, usePage } from '@inertiajs/react';
import {
    BatteryFull,
    Boxes,
    BriefcaseBusiness,
    Code2,
    Cpu,
    Database,
    Folder,
    Github,
    Linkedin,
    Mail,
    MapPin,
    Power,
    Send,
    Sparkles,
    Terminal as TerminalIcon,
    Volume2,
    Wifi,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { OsWindow } from '@/components/rechi-os/os-window';
import { PixelAvatar, PixelSalem } from '@/components/rechi-os/pixel-art';
import { useWindowManager } from '@/hooks/use-window-manager';
import type { WindowKey } from '@/hooks/use-window-manager';
import { parseTerminalCommand } from '@/lib/terminal';
import type {
    Experience,
    Profile,
    Project,
    SkillCategory,
    SocialLink,
} from '@/types/portfolio';

type WelcomeProps = {
    profile: Profile | null;
    projects: Project[];
    experiences: Experience[];
    skills: SkillCategory[];
    socialLinks: SocialLink[];
};

const fallbackProfile: Profile = {
    name: 'Caique Rechi',
    headline: 'Backend-focused Full-Stack Developer',
    location: 'Londrina, Parana, Brasil',
    summary:
        'PHP and Laravel developer building business systems, clean APIs, payment flows and integrations.',
    availability: 'available',
    resume_url: '/resume.pdf',
    contact_email: 'contato@caiquerechi.dev',
};

export default function Welcome({
    profile,
    projects,
    experiences,
    skills,
    socialLinks,
}: WelcomeProps) {
    const page = usePage();
    const dataProfile = profile ?? fallbackProfile;
    const { windows, topZ, focus, minimize, toggleMaximize, move, resize } =
        useWindowManager();
    const [selectedProject, setSelectedProject] = useState(projects[0]);
    const [terminalLines, setTerminalLines] = useState<string[]>([
        'rechi@os:~$ status',
        '> available',
    ]);
    const [terminalInput, setTerminalInput] = useState('');
    const [assistantQuestion, setAssistantQuestion] = useState('');
    const [assistantAnswer, setAssistantAnswer] = useState(
        'Ask about projects, availability or stack.',
    );

    const activeWindow = useMemo(
        () => windows.find((window) => window.z === topZ)?.key,
        [topZ, windows],
    );

    const openApp = (key: WindowKey) => focus(key);

    const runTerminal = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') {
            return;
        }

        const result = parseTerminalCommand(terminalInput);

        if (result.clear) {
            setTerminalLines([]);
        } else {
            setTerminalLines((current) => [
                ...current,
                `rechi@os:~$ ${terminalInput}`,
                ...result.output,
            ]);
        }

        setTerminalInput('');
    };

    const submitContact = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post('/contact', new FormData(event.currentTarget), {
            preserveScroll: true,
            onSuccess: () => event.currentTarget.reset(),
        });
    };

    const askAssistant = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAssistantAnswer('Thinking...');

        const response = await fetch('/ask-rechi', {
            method: 'POST',
            headers: {
                Accept: 'text/event-stream',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN':
                    document.querySelector<HTMLMetaElement>(
                        'meta[name="csrf-token"]',
                    )?.content ?? '',
            },
            body: JSON.stringify({ question: assistantQuestion }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let answer = '';

        while (reader) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            decoder
                .decode(value)
                .split('\n')
                .filter((line) => line.startsWith('data: '))
                .forEach((line) => {
                    const parsed = JSON.parse(line.replace('data: ', '')) as {
                        chunk?: string;
                    };
                    answer += parsed.chunk ?? '';
                    setAssistantAnswer(answer);
                });
        }
    };

    return (
        <>
            <Head title="Rechi OS">
                <meta
                    name="description"
                    content="Portfolio de Caique Rechi, backend-focused full-stack developer especializado em Laravel, APIs, pagamentos e sistemas empresariais."
                />
                <meta property="og:title" content="Rechi OS - Caique Rechi" />
                <meta
                    property="og:description"
                    content="Portfolio em formato de sistema operacional proprio."
                />
                <meta name="twitter:card" content="summary_large_image" />
                <link
                    rel="canonical"
                    href={
                        typeof window === 'undefined'
                            ? '/'
                            : window.location.href
                    }
                />
                <script type="application/ld+json">
                    {JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Person',
                        name: dataProfile.name,
                        jobTitle: dataProfile.headline,
                        address: dataProfile.location,
                    })}
                </script>
            </Head>

            <main className="rechi-os" aria-label="Rechi OS desktop portfolio">
                <TopBar />
                <Dock openApp={openApp} activeWindow={activeWindow} />

                <div className="desktop-stage">
                    <PixelSalem />
                    <div className="build-toast">
                        <Sparkles size={28} />
                        <span>Ready to build.</span>
                    </div>

                    {windows.map((windowState) => (
                        <OsWindow
                            key={windowState.key}
                            windowState={windowState}
                            active={activeWindow === windowState.key}
                            onFocus={focus}
                            onMinimize={minimize}
                            onMaximize={toggleMaximize}
                            onMove={move}
                            onResize={resize}
                        >
                            {windowState.key === 'profile' && (
                                <ProfilePanel
                                    profile={dataProfile}
                                    skills={skills}
                                    socialLinks={socialLinks}
                                    openApp={openApp}
                                />
                            )}
                            {windowState.key === 'projects' && (
                                <ProjectsPanel
                                    projects={projects}
                                    selectedProject={selectedProject}
                                    onSelect={setSelectedProject}
                                    openApp={openApp}
                                />
                            )}
                            {windowState.key === 'terminal' && (
                                <TerminalPanel
                                    lines={terminalLines}
                                    value={terminalInput}
                                    onChange={setTerminalInput}
                                    onKeyDown={runTerminal}
                                />
                            )}
                            {windowState.key === 'experience' && (
                                <ExperiencePanel experiences={experiences} />
                            )}
                            {windowState.key === 'stack' && (
                                <StackPanel skills={skills} />
                            )}
                            {windowState.key === 'contact' && (
                                <ContactPanel
                                    flash={
                                        (
                                            page.props.flash as
                                                { success?: string } | undefined
                                        )?.success
                                    }
                                    onSubmit={submitContact}
                                />
                            )}
                            {windowState.key === 'assistant' && (
                                <AssistantPanel
                                    answer={assistantAnswer}
                                    question={assistantQuestion}
                                    onQuestion={setAssistantQuestion}
                                    onSubmit={askAssistant}
                                />
                            )}
                        </OsWindow>
                    ))}
                </div>

                <MobilePanels
                    profile={dataProfile}
                    projects={projects}
                    experiences={experiences}
                    skills={skills}
                    socialLinks={socialLinks}
                    onContact={submitContact}
                />
            </main>
        </>
    );
}

function TopBar() {
    return (
        <header className="top-bar">
            <strong className="top-bar-brand">
                <img src="/assets/brand/logo.svg" alt="RECHI OS" />
            </strong>
            <div
                className="top-indicators"
                aria-label="decorative system indicators"
            >
                <Wifi size={18} />
                <Volume2 size={18} />
                <span>100%</span>
                <BatteryFull size={28} />
                <span className="clock">10:24 AM</span>
            </div>
        </header>
    );
}

function Dock({
    openApp,
    activeWindow,
}: {
    openApp: (key: WindowKey) => void;
    activeWindow?: WindowKey;
}) {
    const apps: Array<{
        key: WindowKey;
        label: string;
        icon: typeof TerminalIcon;
    }> = [
        { key: 'profile', label: 'Profile', icon: TerminalIcon },
        { key: 'projects', label: 'Projects', icon: Folder },
        { key: 'experience', label: 'Experience', icon: BriefcaseBusiness },
        { key: 'stack', label: 'Stack', icon: Boxes },
        { key: 'contact', label: 'Contact', icon: Mail },
        { key: 'assistant', label: 'Ask Rechi', icon: Sparkles },
    ];

    return (
        <nav className="dock" aria-label="Rechi OS applications">
            {apps.map(({ key, label, icon: Icon }) => (
                <button
                    key={key}
                    type="button"
                    className={activeWindow === key ? 'active' : ''}
                    onClick={() => openApp(key)}
                    title={label}
                >
                    <Icon size={34} />
                    <span>{label}</span>
                </button>
            ))}
            <button type="button" className="power" title="Power">
                <Power size={34} />
            </button>
        </nav>
    );
}

function ProfilePanel({
    profile,
    skills,
    socialLinks,
    openApp,
}: {
    profile: Profile;
    skills: SkillCategory[];
    socialLinks: SocialLink[];
    openApp: (key: WindowKey) => void;
}) {
    return (
        <div className="profile-grid">
            <PixelAvatar />
            <section>
                <h1 className="pixel-title">
                    {profile.name.split(' ')[0]}{' '}
                    <span>{profile.name.split(' ').slice(1).join(' ')}</span>
                </h1>
                <p className="headline">{profile.headline}</p>
                <p className="location">
                    <MapPin size={18} /> {profile.location}
                </p>
                <p className="available">&gt; {profile.availability}</p>
                <p className="summary">{profile.summary}</p>
                <div className="chip-row">
                    {skills
                        .flatMap((category) => category.skills)
                        .slice(0, 8)
                        .map((skill) => (
                            <span key={skill.slug}>
                                {skill.badge_label ?? skill.name}
                            </span>
                        ))}
                </div>
                <div className="action-row">
                    {socialLinks.map((link) => (
                        <a key={link.label} href={link.url}>
                            {link.icon === 'github' && <Github size={18} />}
                            {link.icon === 'linkedin' && <Linkedin size={18} />}
                            {link.icon === 'mail' && <Mail size={18} />}
                            {link.label}
                        </a>
                    ))}
                    <button type="button" onClick={() => openApp('contact')}>
                        <Send size={18} /> Contact
                    </button>
                </div>
            </section>
        </div>
    );
}

function ProjectsPanel({
    projects,
    selectedProject,
    onSelect,
    openApp,
}: {
    projects: Project[];
    selectedProject?: Project;
    onSelect: (project: Project) => void;
    openApp: (key: WindowKey) => void;
}) {
    return (
        <div className="projects-layout">
            <div className="project-list">
                {projects.map((project) => (
                    <button
                        key={project.slug}
                        type="button"
                        onClick={() => onSelect(project)}
                        className={
                            selectedProject?.slug === project.slug
                                ? 'selected'
                                : ''
                        }
                    >
                        <span className="project-icon">
                            {project.name === 'BudgetCore' ? (
                                <Database size={32} />
                            ) : (
                                <Boxes size={32} />
                            )}
                        </span>
                        <span>
                            <strong>{project.name}</strong>
                            <small>{project.summary}</small>
                        </span>
                    </button>
                ))}
            </div>
            {selectedProject && (
                <article className="case-study">
                    <h2>{selectedProject.name} - Case Study</h2>
                    <p>{selectedProject.problem}</p>
                    <div className="architecture">
                        {selectedProject.architecture.map((item) => (
                            <span key={item}>{item}</span>
                        ))}
                    </div>
                    <TechnologyRow
                        skills={selectedProject.technology_badges}
                        fallback={selectedProject.technologies}
                    />
                    <div className="case-columns">
                        <section>
                            <h3>Responsibilities</h3>
                            <ul>
                                {selectedProject.responsibilities.map(
                                    (item) => (
                                        <li key={item}>{item}</li>
                                    ),
                                )}
                            </ul>
                        </section>
                        <section>
                            <h3>Decisions</h3>
                            <ul>
                                {selectedProject.technical_decisions.map(
                                    (item) => (
                                        <li key={item}>{item}</li>
                                    ),
                                )}
                            </ul>
                        </section>
                    </div>
                    <div className="metric-row">
                        {Object.entries(selectedProject.metrics ?? {}).map(
                            ([key, value]) => (
                                <span key={key}>
                                    <strong>{value}</strong>
                                    <small>{key.replaceAll('_', ' ')}</small>
                                </span>
                            ),
                        )}
                    </div>
                    <button
                        type="button"
                        className="source-link"
                        onClick={() => openApp('assistant')}
                    >
                        Ask Rechi about this <Code2 size={17} />
                    </button>
                </article>
            )}
        </div>
    );
}

function TerminalPanel({
    lines,
    value,
    onChange,
    onKeyDown,
}: {
    lines: string[];
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
    return (
        <div className="terminal-panel">
            {lines.map((line, index) => (
                <p
                    key={`${line}-${index}`}
                    className={line.startsWith('>') ? 'terminal-ok' : ''}
                >
                    {line}
                </p>
            ))}
            <label>
                <span>rechi@os:~$</span>
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                />
            </label>
        </div>
    );
}

function ExperiencePanel({ experiences }: { experiences: Experience[] }) {
    return (
        <ol className="timeline">
            {experiences.map((experience) => (
                <li key={`${experience.role}-${experience.started_at}`}>
                    <time>{new Date(experience.started_at).getFullYear()}</time>
                    <strong>{experience.role}</strong>
                    <span>
                        {experience.company}
                        {experience.employment_type
                            ? ` - ${experience.employment_type}`
                            : ''}
                    </span>
                    {experience.location && (
                        <span className="timeline-location">
                            {experience.location}
                        </span>
                    )}
                    <p>{experience.summary}</p>
                    {experience.achievements &&
                        experience.achievements.length > 0 && (
                            <ul>
                                {experience.achievements.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        )}
                    <TechnologyRow skills={experience.technologies} />
                </li>
            ))}
        </ol>
    );
}

function StackPanel({ skills }: { skills: SkillCategory[] }) {
    return (
        <div className="stack-grid">
            {skills.map((category) => (
                <section key={category.slug}>
                    <h3>
                        <Cpu size={16} /> {category.name}
                    </h3>
                    <div>
                        {category.skills.map((skill) => (
                            <span
                                key={skill.slug}
                                title={`${skill.proficiency_level} - ${skill.years_experience} years`}
                                style={{
                                    borderColor: skill.badge_color
                                        ? `${skill.badge_color}88`
                                        : undefined,
                                }}
                            >
                                <strong>
                                    {skill.badge_label ?? skill.name}
                                </strong>
                                <small>
                                    {skill.years_experience}y -{' '}
                                    {skill.proficiency_level}
                                </small>
                            </span>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function TechnologyRow({
    skills,
    fallback = [],
}: {
    skills?: Array<{
        badge_label?: string | null;
        name: string;
        slug: string;
        years_experience?: number;
        proficiency_level?: string;
    }>;
    fallback?: string[];
}) {
    const labels =
        skills && skills.length > 0
            ? skills.map((skill) => ({
                  key: skill.slug,
                  label: skill.badge_label ?? skill.name,
                  meta:
                      skill.years_experience && skill.proficiency_level
                          ? `${skill.years_experience}y ${skill.proficiency_level}`
                          : null,
              }))
            : fallback.map((label) => ({ key: label, label, meta: null }));

    if (labels.length === 0) {
        return null;
    }

    return (
        <div className="tech-row">
            {labels.map((skill) => (
                <span key={skill.key}>
                    {skill.label}
                    {skill.meta && <small>{skill.meta}</small>}
                </span>
            ))}
        </div>
    );
}

function ContactPanel({
    flash,
    onSubmit,
}: {
    flash?: string;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <form className="contact-form" onSubmit={onSubmit}>
            {flash && <p className="success-message">{flash}</p>}
            <input name="name" placeholder="Name" required />
            <input name="email" placeholder="Email" type="email" required />
            <input name="subject" placeholder="Subject" required />
            <textarea
                name="message"
                placeholder="Message"
                required
                minLength={20}
            />
            <input
                className="honeypot"
                name="website"
                tabIndex={-1}
                autoComplete="off"
            />
            <label className="consent">
                <input type="checkbox" name="consent" value="1" required /> I
                agree to be contacted about this message.
            </label>
            <button type="submit">
                <Send size={18} /> Send message
            </button>
        </form>
    );
}

function AssistantPanel({
    answer,
    question,
    onQuestion,
    onSubmit,
}: {
    answer: string;
    question: string;
    onQuestion: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <div className="assistant-panel">
            <p>{answer}</p>
            <form onSubmit={onSubmit}>
                <input
                    value={question}
                    onChange={(event) => onQuestion(event.target.value)}
                    placeholder="Ask about Caique..."
                    required
                    minLength={3}
                />
                <button type="submit" title="Ask Rechi">
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}

function MobilePanels(props: {
    profile: Profile;
    projects: Project[];
    experiences: Experience[];
    skills: SkillCategory[];
    socialLinks: SocialLink[];
    onContact: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <section className="mobile-panels">
            <ProfilePanel
                profile={props.profile}
                skills={props.skills}
                socialLinks={props.socialLinks}
                openApp={() => undefined}
            />
            <ProjectsPanel
                projects={props.projects}
                selectedProject={props.projects[0]}
                onSelect={() => undefined}
                openApp={() => undefined}
            />
            <ExperiencePanel experiences={props.experiences} />
            <StackPanel skills={props.skills} />
            <ContactPanel onSubmit={props.onContact} />
        </section>
    );
}
