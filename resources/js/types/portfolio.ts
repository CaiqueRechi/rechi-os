export type Profile = {
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
};

export type Skill = {
    name: string;
    slug: string;
    summary?: string | null;
    years_experience: number;
    proficiency_level: string;
    proficiency_percent: number;
    first_used_year?: number | null;
    last_used_year?: number | null;
    currently_using: boolean;
    badge_label?: string | null;
    badge_color?: string | null;
    icon?: string | null;
    featured: boolean;
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
    technology_badges?: Skill[];
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
    location?: string | null;
    employment_type?: string | null;
    summary: string;
    achievements?: string[];
    started_at: string;
    ended_at?: string | null;
    current: boolean;
    technologies?: Skill[];
};

export type SkillCategory = {
    name: string;
    slug: string;
    skills: Skill[];
};

export type SocialLink = {
    label: string;
    url: string;
    icon?: string | null;
};
