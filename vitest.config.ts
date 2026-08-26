import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['resources/js/tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            include: [
                'resources/js/lib/terminal.ts',
                'resources/js/hooks/use-window-manager.ts',
                'resources/js/components/rechi-os/**/*.tsx',
            ],
        },
    },
});
