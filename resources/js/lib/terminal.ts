const allowedCommands = {
    help: [
        'help, about, projects, experience, stack, contact, clear, salem, whoami',
    ],
    about: [
        'Caique Rechi',
        'Backend-focused full-stack developer from Londrina, Brazil.',
    ],
    projects: ['IMS', 'BudgetCore', 'Payment Flow'],
    experience: [
        '2019 Junior Developer',
        '2021 Backend Developer',
        '2023 Backend Engineer',
    ],
    stack: ['PHP, Laravel, APIs, MySQL, Redis, React, TypeScript, Docker'],
    contact: ['Open Contact or send an email to contato@caiquerechi.dev'],
    salem: ['Salem purrs: production needs logs, tests, and snacks.'],
    whoami: ['rechi@os'],
    clear: [],
} as const;

export type TerminalCommand = keyof typeof allowedCommands;

export function parseTerminalCommand(input: string): {
    command: string;
    output: string[];
    clear: boolean;
    allowed: boolean;
} {
    const command = input.trim().toLowerCase();

    if (command in allowedCommands) {
        return {
            command,
            output: [...allowedCommands[command as TerminalCommand]],
            clear: command === 'clear',
            allowed: true,
        };
    }

    return {
        command,
        output: ['Command not allowed. Type help.'],
        clear: false,
        allowed: false,
    };
}
