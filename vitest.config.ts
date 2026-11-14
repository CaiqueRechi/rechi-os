import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': '/resources/js',
            '@cvc': fileURLToPath(
                new URL(
                    './vendor/caiquerechi/crow-vault-canvas/resources/js',
                    import.meta.url,
                ),
            ),
        },
        preserveSymlinks: true,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['resources/js/tests/setup.ts'],
        include: [
            'resources/js/tests/**/*.test.{ts,tsx}',
            'vendor/caiquerechi/crow-vault-canvas/resources/js/tests/**/*.test.{ts,tsx}',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            include: [
                'resources/js/lib/terminal.ts',
                'resources/js/hooks/use-window-manager.ts',
                'resources/js/components/rechi-os/**/*.tsx',
                'vendor/caiquerechi/crow-vault-canvas/resources/js/**/*.{ts,tsx}',
            ],
        },
    },
});
