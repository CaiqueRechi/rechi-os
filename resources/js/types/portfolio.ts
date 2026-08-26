export type Profile = {
    name: string;
    headline: string;
    location: string;
    summary: string;
    availability: string;
    avatar_path?: string | null;
    resume_url?: string | null;
    contact_email: string;
};

export type Project = {
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
};

export type Experience = {
    role: string;
    company: string;
    summary: string;
    started_at: string;
    ended_at?: string | null;
    current: boolean;
};

export type SkillCategory = {
    name: string;
    slug: string;
    skills: Array<{
        name: string;
        slug: string;
        summary?: string | null;
    }>;
};

export type SocialLink = {
    label: string;
    url: string;
    icon?: string | null;
};
