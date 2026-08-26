import { describe, expect, it } from 'vitest';

import { parseTerminalCommand } from '@/lib/terminal';

describe('parseTerminalCommand', () => {
    it('allows only whitelisted commands', () => {
        expect(parseTerminalCommand('projects')).toMatchObject({
            allowed: true,
            output: ['IMS', 'BudgetCore', 'Payment Flow'],
        });
    });

    it('rejects shell-like commands', () => {
        expect(parseTerminalCommand('cat .env')).toMatchObject({
            allowed: false,
            output: ['Command not allowed. Type help.'],
        });
    });

    it('marks clear without returning output', () => {
        expect(parseTerminalCommand('clear')).toMatchObject({
            allowed: true,
            clear: true,
            output: [],
        });
    });

    it('normalizes command whitespace and casing', () => {
        expect(parseTerminalCommand('  WHOAMI  ')).toMatchObject({
            allowed: true,
            command: 'whoami',
            output: ['rechi@os'],
        });
    });
});
