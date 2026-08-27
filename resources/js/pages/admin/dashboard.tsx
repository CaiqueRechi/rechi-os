import { Head, router } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';

type Skill = {
    id: number;
    skill_category_id: number;
    name: string;
    slug: string;
    summary?: string | null;
    years_experience: number | string;
    proficiency_level: string;
    proficiency_percent: number;
    first_used_year?: number | null;
    last_used_year?: number | null;
    currently_using: boolean;
    badge_label?: string | null;
    badge_color?: string | null;
    icon?: string | null;
    featured: boolean;
    sort_order: number;
};

type SkillCategory = {
    id: number;
    name: string;
    slug: string;
    sort_order: number;
    skills: Skill[];
};

type Profile = {
    name: string;
    headline: string;
    location: string;
    summary: string;
    availability: string;
    avatar_path?: string | null;
    resume_url?: string | null;
    contact_email: string;
    phone?: string | null;
    website_url?: string | null;
    ai_base_prompt?: string | null;
};

type Experience = {
    id: number;
    role: string;
    company: string;
    location?: string | null;
    employment_type?: string | null;
    summary: string;
    achievements?: string[] | null;
    started_at: string;
    ended_at?: string | null;
    current: boolean;
    sort_order: number;
    skills?: Skill[];
};

type Project = {
    id: number;
    name: string;
    slug: string;
    summary: string;
    problem: string;
    responsibilities: string[];
    technical_decisions: string[];
    architecture: string[];
    technologies: string[];
    results: string[];
    metrics?: Record<string, string> | null;
    demo_url?: string | null;
    repository_url?: string | null;
    status: string;
    period: string;
    featured: boolean;
    sort_order: number;
    published_at?: string | null;
    skills?: Skill[];
};

type SocialLink = {
    id: number;
    label: string;
    url: string;
    icon?: string | null;
    public: boolean;
    sort_order: number;
};

type AdminDashboardProps = {
    stats: Record<'projects' | 'experiences' | 'skills' | 'messages', number>;
    profile: Profile | null;
    projects: Project[];
    experiences: Experience[];
    skillCategories: SkillCategory[];
    skills: Skill[];
    socialLinks: SocialLink[];
    messages: Array<{
        id: number;
        name: string;
        email: string;
        subject: string;
        status: string;
        created_at: string;
    }>;
};

const inputClass =
    'w-full rounded border border-[#FFFBEA22] bg-[#0e0d14] px-3 py-2 text-[#FFFBEA] outline-none focus:border-[#DB633A]';
const labelClass =
    'grid gap-1 text-xs uppercase tracking-normal text-[#D4A047]';
const panelClass = 'rounded-lg border border-[#FFFBEA22] bg-[#0e0d14] p-5';
const gridClass = 'grid gap-3 md:grid-cols-2';

export default function AdminDashboard({
    stats,
    profile,
    projects,
    experiences,
    skillCategories,
    skills,
    socialLinks,
    messages,
}: AdminDashboardProps) {
    return (
        <>
            <Head title="Admin - Rechi OS" />
            <main className="min-h-screen bg-[#1D161F] p-6 font-mono text-[#FFFBEA] md:p-8">
                <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[#8ee35f]">&gt; admin unlocked</p>
                        <h1 className="text-4xl font-black text-[#FFECA5]">
                            RECHI OS CONTROL
                        </h1>
                    </div>
                    <a className="text-[#DB633A] underline" href="/">
                        Open portfolio
                    </a>
                </header>

                <section className="grid gap-4 md:grid-cols-4">
                    {Object.entries(stats).map(([label, value]) => (
                        <article key={label} className={panelClass}>
                            <p className="text-[#D4A047] uppercase">{label}</p>
                            <strong className="mt-2 block text-3xl text-[#DB633A]">
                                {value}
                            </strong>
                        </article>
                    ))}
                </section>

                <div className="mt-8 grid gap-8">
                    <ProfileEditor profile={profile} />
                    <SkillsEditor
                        categories={skillCategories}
                        skills={skills}
                    />
                    <ExperiencesEditor
                        experiences={experiences}
                        skills={skills}
                    />
                    <ProjectsEditor projects={projects} skills={skills} />
                    <SocialLinksEditor links={socialLinks} />
                    <MessagesPanel messages={messages} />
                </div>
            </main>
        </>
    );
}

function ProfileEditor({ profile }: { profile: Profile | null }) {
    return (
        <Section title="Profile">
            <form
                className="grid gap-4"
                onSubmit={(event) => submit(event, '/admin/profile', 'patch')}
            >
                <div className={gridClass}>
                    <Input name="name" label="Name" value={profile?.name} />
                    <Input
                        name="headline"
                        label="Headline"
                        value={profile?.headline}
                    />
                    <Input
                        name="location"
                        label="Location"
                        value={profile?.location}
                    />
                    <Input
                        name="availability"
                        label="Availability"
                        value={profile?.availability}
                    />
                    <Input
                        name="contact_email"
                        label="Contact email"
                        type="email"
                        value={profile?.contact_email}
                    />
                    <Input name="phone" label="Phone" value={profile?.phone} />
                    <Input
                        name="website_url"
                        label="Website URL"
                        value={profile?.website_url}
                    />
                    <Input
                        name="resume_url"
                        label="Resume URL"
                        value={profile?.resume_url}
                    />
                    <Input
                        name="avatar_path"
                        label="Avatar path"
                        value={profile?.avatar_path}
                    />
                </div>
                <Textarea
                    name="summary"
                    label="Summary"
                    value={profile?.summary}
                />
                <Textarea
                    name="ai_base_prompt"
                    label="AI base prompt"
                    value={profile?.ai_base_prompt}
                />
                <SubmitButton label="Save profile" />
            </form>
        </Section>
    );
}

function SkillsEditor({
    categories,
    skills,
}: {
    categories: SkillCategory[];
    skills: Skill[];
}) {
    return (
        <Section title="Technologies and badges">
            <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
                <div className="grid content-start gap-4">
                    <CategoryForm />
                    {categories.map((category) => (
                        <CategoryForm key={category.id} category={category} />
                    ))}
                </div>
                <div className="grid gap-4">
                    <SkillForm categories={categories} />
                    {skills.map((skill) => (
                        <SkillForm
                            key={skill.id}
                            skill={skill}
                            categories={categories}
                        />
                    ))}
                </div>
            </div>
        </Section>
    );
}

function CategoryForm({ category }: { category?: SkillCategory }) {
    return (
        <form
            className={panelClass}
            onSubmit={(event) =>
                submit(
                    event,
                    category
                        ? `/admin/skill-categories/${category.id}`
                        : '/admin/skill-categories',
                    category ? 'patch' : 'post',
                )
            }
        >
            <h3 className="mb-3 text-[#FFECA5]">
                {category ? category.name : 'New category'}
            </h3>
            <div className="grid gap-3">
                <Input name="name" label="Name" value={category?.name} />
                <Input name="slug" label="Slug" value={category?.slug} />
                <Input
                    name="sort_order"
                    label="Order"
                    type="number"
                    value={category?.sort_order ?? 0}
                />
                <FormActions
                    saveLabel={category ? 'Save category' : 'Create category'}
                    deleteUrl={
                        category
                            ? `/admin/skill-categories/${category.id}`
                            : undefined
                    }
                />
            </div>
        </form>
    );
}

function SkillForm({
    skill,
    categories,
}: {
    skill?: Skill;
    categories: SkillCategory[];
}) {
    return (
        <form
            className={panelClass}
            onSubmit={(event) =>
                submit(
                    event,
                    skill ? `/admin/skills/${skill.id}` : '/admin/skills',
                    skill ? 'patch' : 'post',
                )
            }
        >
            <h3 className="mb-3 text-[#FFECA5]">
                {skill ? skill.name : 'New technology'}
            </h3>
            <div className={gridClass}>
                <Select
                    name="skill_category_id"
                    label="Category"
                    value={skill?.skill_category_id}
                    options={categories.map((category) => ({
                        value: category.id,
                        label: category.name,
                    }))}
                />
                <Input name="name" label="Name" value={skill?.name} />
                <Input name="slug" label="Slug" value={skill?.slug} />
                <Input
                    name="years_experience"
                    label="Years using"
                    type="number"
                    step="0.1"
                    value={skill?.years_experience ?? 0}
                />
                <Input
                    name="proficiency_level"
                    label="Level"
                    value={skill?.proficiency_level ?? 'working'}
                />
                <Input
                    name="proficiency_percent"
                    label="Proficiency %"
                    type="number"
                    value={skill?.proficiency_percent ?? 50}
                />
                <Input
                    name="first_used_year"
                    label="First used year"
                    type="number"
                    value={skill?.first_used_year}
                />
                <Input
                    name="last_used_year"
                    label="Last used year"
                    type="number"
                    value={skill?.last_used_year}
                />
                <Input
                    name="badge_label"
                    label="Badge label"
                    value={skill?.badge_label}
                />
                <Input
                    name="badge_color"
                    label="Badge color"
                    value={skill?.badge_color ?? '#DB633A'}
                />
                <Input name="icon" label="Icon" value={skill?.icon} />
                <Input
                    name="sort_order"
                    label="Order"
                    type="number"
                    value={skill?.sort_order ?? 0}
                />
            </div>
            <Textarea name="summary" label="Summary" value={skill?.summary} />
            <div className="mt-3 flex flex-wrap gap-4">
                <Checkbox
                    name="currently_using"
                    label="Currently using"
                    checked={skill?.currently_using ?? true}
                />
                <Checkbox
                    name="featured"
                    label="Featured badge"
                    checked={skill?.featured ?? false}
                />
            </div>
            <FormActions
                saveLabel={skill ? 'Save technology' : 'Create technology'}
                deleteUrl={skill ? `/admin/skills/${skill.id}` : undefined}
            />
        </form>
    );
}

function ExperiencesEditor({
    experiences,
    skills,
}: {
    experiences: Experience[];
    skills: Skill[];
}) {
    return (
        <Section title="Curriculum experiences">
            <div className="grid gap-4">
                <ExperienceForm skills={skills} />
                {experiences.map((experience) => (
                    <ExperienceForm
                        key={experience.id}
                        experience={experience}
                        skills={skills}
                    />
                ))}
            </div>
        </Section>
    );
}

function ExperienceForm({
    experience,
    skills,
}: {
    experience?: Experience;
    skills: Skill[];
}) {
    return (
        <form
            className={panelClass}
            onSubmit={(event) =>
                submit(
                    event,
                    experience
                        ? `/admin/experiences/${experience.id}`
                        : '/admin/experiences',
                    experience ? 'patch' : 'post',
                )
            }
        >
            <h3 className="mb-3 text-[#FFECA5]">
                {experience
                    ? `${experience.role} at ${experience.company}`
                    : 'New experience'}
            </h3>
            <div className={gridClass}>
                <Input name="role" label="Role" value={experience?.role} />
                <Input
                    name="company"
                    label="Company"
                    value={experience?.company}
                />
                <Input
                    name="location"
                    label="Location"
                    value={experience?.location}
                />
                <Input
                    name="employment_type"
                    label="Employment type"
                    value={experience?.employment_type}
                />
                <Input
                    name="started_at"
                    label="Started at"
                    type="date"
                    value={dateValue(experience?.started_at)}
                />
                <Input
                    name="ended_at"
                    label="Ended at"
                    type="date"
                    value={dateValue(experience?.ended_at)}
                />
                <Input
                    name="sort_order"
                    label="Order"
                    type="number"
                    value={experience?.sort_order ?? 0}
                />
            </div>
            <Textarea
                name="summary"
                label="Summary"
                value={experience?.summary}
            />
            <Textarea
                name="achievements_text"
                label="Achievements, one per line"
                value={linesValue(experience?.achievements)}
            />
            <SkillMultiSelect skills={skills} selected={experience?.skills} />
            <div className="mt-3">
                <Checkbox
                    name="current"
                    label="Current role"
                    checked={experience?.current ?? false}
                />
            </div>
            <FormActions
                saveLabel={experience ? 'Save experience' : 'Create experience'}
                deleteUrl={
                    experience
                        ? `/admin/experiences/${experience.id}`
                        : undefined
                }
            />
        </form>
    );
}

function ProjectsEditor({
    projects,
    skills,
}: {
    projects: Project[];
    skills: Skill[];
}) {
    return (
        <Section title="Projects and case studies">
            <div className="grid gap-4">
                <ProjectForm skills={skills} />
                {projects.map((project) => (
                    <ProjectForm
                        key={project.id}
                        project={project}
                        skills={skills}
                    />
                ))}
            </div>
        </Section>
    );
}

function ProjectForm({
    project,
    skills,
}: {
    project?: Project;
    skills: Skill[];
}) {
    return (
        <form
            className={panelClass}
            onSubmit={(event) =>
                submit(
                    event,
                    project
                        ? `/admin/projects/${project.id}`
                        : '/admin/projects',
                    project ? 'patch' : 'post',
                )
            }
        >
            <h3 className="mb-3 text-[#FFECA5]">
                {project ? project.name : 'New project'}
            </h3>
            <div className={gridClass}>
                <Input name="name" label="Name" value={project?.name} />
                <Input name="slug" label="Slug" value={project?.slug} />
                <Input
                    name="summary"
                    label="Summary"
                    value={project?.summary}
                />
                <Input name="period" label="Period" value={project?.period} />
                <Input
                    name="demo_url"
                    label="Demo URL"
                    value={project?.demo_url}
                />
                <Input
                    name="repository_url"
                    label="Repository URL"
                    value={project?.repository_url}
                />
                <Select
                    name="status"
                    label="Status"
                    value={project?.status ?? 'published'}
                    options={[
                        { value: 'draft', label: 'draft' },
                        { value: 'published', label: 'published' },
                        { value: 'archived', label: 'archived' },
                    ]}
                />
                <Input
                    name="sort_order"
                    label="Order"
                    type="number"
                    value={project?.sort_order ?? 0}
                />
                <Input
                    name="published_at"
                    label="Published at"
                    type="date"
                    value={dateValue(project?.published_at)}
                />
            </div>
            <Textarea name="problem" label="Problem" value={project?.problem} />
            <div className={gridClass}>
                <Textarea
                    name="responsibilities_text"
                    label="Responsibilities, one per line"
                    value={linesValue(project?.responsibilities)}
                />
                <Textarea
                    name="technical_decisions_text"
                    label="Technical decisions, one per line"
                    value={linesValue(project?.technical_decisions)}
                />
                <Textarea
                    name="architecture_text"
                    label="Architecture, one per line"
                    value={linesValue(project?.architecture)}
                />
                <Textarea
                    name="technologies_text"
                    label="Legacy tech names, one per line"
                    value={linesValue(project?.technologies)}
                />
                <Textarea
                    name="results_text"
                    label="Results, one per line"
                    value={linesValue(project?.results)}
                />
                <Textarea
                    name="metrics_text"
                    label="Metrics as key=value, one per line"
                    value={metricsValue(project?.metrics)}
                />
            </div>
            <SkillMultiSelect skills={skills} selected={project?.skills} />
            <div className="mt-3">
                <Checkbox
                    name="featured"
                    label="Featured project"
                    checked={project?.featured ?? false}
                />
            </div>
            <FormActions
                saveLabel={project ? 'Save project' : 'Create project'}
                deleteUrl={
                    project ? `/admin/projects/${project.id}` : undefined
                }
            />
        </form>
    );
}

function SocialLinksEditor({ links }: { links: SocialLink[] }) {
    return (
        <Section title="Social links">
            <div className="grid gap-4 md:grid-cols-2">
                <SocialLinkForm />
                {links.map((link) => (
                    <SocialLinkForm key={link.id} link={link} />
                ))}
            </div>
        </Section>
    );
}

function SocialLinkForm({ link }: { link?: SocialLink }) {
    return (
        <form
            className={panelClass}
            onSubmit={(event) =>
                submit(
                    event,
                    link
                        ? `/admin/social-links/${link.id}`
                        : '/admin/social-links',
                    link ? 'patch' : 'post',
                )
            }
        >
            <h3 className="mb-3 text-[#FFECA5]">
                {link ? link.label : 'New link'}
            </h3>
            <div className="grid gap-3">
                <Input name="label" label="Label" value={link?.label} />
                <Input name="url" label="URL" value={link?.url} />
                <Input name="icon" label="Icon" value={link?.icon} />
                <Input
                    name="sort_order"
                    label="Order"
                    type="number"
                    value={link?.sort_order ?? 0}
                />
                <Checkbox
                    name="public"
                    label="Public link"
                    checked={link?.public ?? true}
                />
                <FormActions
                    saveLabel={link ? 'Save link' : 'Create link'}
                    deleteUrl={
                        link ? `/admin/social-links/${link.id}` : undefined
                    }
                />
            </div>
        </form>
    );
}

function MessagesPanel({
    messages,
}: {
    messages: AdminDashboardProps['messages'];
}) {
    return (
        <Section title="Messages">
            <div className="grid gap-3">
                {messages.map((message) => (
                    <article
                        key={message.id}
                        className="rounded-md border border-[#FFFBEA18] p-4"
                    >
                        <strong>{message.subject}</strong>
                        <p className="text-sm text-[#FFFBEA99]">
                            {message.name} - {message.email} - {message.status}
                        </p>
                    </article>
                ))}
            </div>
        </Section>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="mb-4 text-2xl font-black text-[#FFECA5]">{title}</h2>
            {children}
        </section>
    );
}

function Input({
    label,
    name,
    type = 'text',
    value,
    step,
}: {
    label: string;
    name: string;
    type?: string;
    value?: string | number | null;
    step?: string;
}) {
    return (
        <label className={labelClass}>
            {label}
            <input
                className={inputClass}
                name={name}
                type={type}
                step={step}
                defaultValue={value ?? ''}
            />
        </label>
    );
}

function Textarea({
    label,
    name,
    value,
}: {
    label: string;
    name: string;
    value?: string | null;
}) {
    return (
        <label className={labelClass}>
            {label}
            <textarea
                className={`${inputClass} min-h-28`}
                name={name}
                defaultValue={value ?? ''}
            />
        </label>
    );
}

function Select({
    label,
    name,
    value,
    options,
}: {
    label: string;
    name: string;
    value?: string | number | null;
    options: Array<{ value: string | number; label: string }>;
}) {
    return (
        <label className={labelClass}>
            {label}
            <select
                className={inputClass}
                name={name}
                defaultValue={value ?? ''}
            >
                <option value="" disabled>
                    Select
                </option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function SkillMultiSelect({
    skills,
    selected,
}: {
    skills: Skill[];
    selected?: Skill[];
}) {
    return (
        <label className={`${labelClass} mt-3`}>
            Linked technologies
            <select
                className={`${inputClass} min-h-36`}
                name="skill_ids[]"
                multiple
                defaultValue={(selected ?? []).map((skill) => String(skill.id))}
            >
                {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                        {skill.name}
                    </option>
                ))}
            </select>
        </label>
    );
}

function Checkbox({
    label,
    name,
    checked,
}: {
    label: string;
    name: string;
    checked: boolean;
}) {
    return (
        <label className="inline-flex items-center gap-2 text-sm text-[#FFFBEA]">
            <input type="hidden" name={name} value="0" />
            <input
                name={name}
                type="checkbox"
                value="1"
                defaultChecked={checked}
            />
            {label}
        </label>
    );
}

function FormActions({
    saveLabel,
    deleteUrl,
}: {
    saveLabel: string;
    deleteUrl?: string;
}) {
    return (
        <div className="mt-4 flex flex-wrap gap-3">
            <SubmitButton label={saveLabel} />
            {deleteUrl && <DeleteButton url={deleteUrl} />}
        </div>
    );
}

function SubmitButton({ label }: { label: string }) {
    return (
        <button
            className="rounded border border-[#DB633A66] bg-[#DB633A22] px-4 py-2 text-[#FFECA5]"
            type="submit"
        >
            {label}
        </button>
    );
}

function DeleteButton({ url }: { url: string }) {
    return (
        <button
            className="rounded border border-red-400/40 px-4 py-2 text-red-200"
            type="button"
            onClick={() => {
                if (window.confirm('Remove this item?')) {
                    router.delete(url, { preserveScroll: true });
                }
            }}
        >
            Delete
        </button>
    );
}

function submit(
    event: FormEvent<HTMLFormElement>,
    url: string,
    method: string,
) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);

    if (method !== 'post') {
        data.append('_method', method);
    }

    router.post(url, data, { preserveScroll: true });
}

function linesValue(value?: string[] | null): string {
    return value?.join('\n') ?? '';
}

function metricsValue(value?: Record<string, string> | null): string {
    return Object.entries(value ?? {})
        .map(([key, content]) => `${key}=${content}`)
        .join('\n');
}

function dateValue(value?: string | null): string {
    return value?.slice(0, 10) ?? '';
}
