import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const assetsCss = readFileSync(
    resolve(process.cwd(), 'resources/css/assets.css'),
    'utf8',
);
const appCss = readFileSync(
    resolve(process.cwd(), 'resources/css/app.css'),
    'utf8',
);

describe('brand assets', () => {
    it('keeps the landing page palette in one stylesheet', () => {
        expect(assetsCss).toContain('--asset-color-background: #1d161f');
        expect(assetsCss).toContain('--asset-color-purple: #533d64');
        expect(assetsCss).toContain('--asset-color-orange: #db633a');
        expect(assetsCss).toContain('--asset-color-gold: #d4a047');
        expect(assetsCss).toContain('--asset-color-cream: #ffeca5');
        expect(assetsCss).toContain('--asset-color-soft-cream: #fffbea');
    });

    it('loads the shared assets before the application theme', () => {
        expect(appCss).toContain("@import './assets.css'");
        expect(appCss).toContain('--background: var(--asset-color-background)');
        expect(appCss).not.toContain('#1d161f');
        expect(appCss).not.toContain('#533d64');
        expect(appCss).not.toContain('#db633a');
    });
});
