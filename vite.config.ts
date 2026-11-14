import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const shouldGenerateWayfinder = process.env.WAYFINDER_GENERATE !== 'false';

export default defineConfig({
    resolve: {
        alias: {
            '@cvc': fileURLToPath(
                new URL(
                    './vendor/caiquerechi/crow-vault-canvas/resources/js',
                    import.meta.url,
                ),
            ),
        },
        preserveSymlinks: true,
    },
    plugins: [
        shouldGenerateWayfinder
            ? wayfinder({
                  formVariants: true,
              })
            : null,
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
                '!**/vendor/caiquerechi/crow-vault-canvas/**',
            ],
        },
    },
});
