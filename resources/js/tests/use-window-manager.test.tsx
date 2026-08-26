import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useWindowManager } from '@/hooks/use-window-manager';

describe('useWindowManager', () => {
    it('focuses, minimizes and maximizes windows', () => {
        const { result } = renderHook(() => useWindowManager());

        act(() => result.current.focus('stack'));
        expect(
            result.current.windows.find((window) => window.key === 'stack'),
        ).toMatchObject({
            minimized: false,
            z: 5,
        });

        act(() => result.current.minimize('stack'));
        expect(
            result.current.windows.find((window) => window.key === 'stack')
                ?.minimized,
        ).toBe(true);

        act(() => result.current.toggleMaximize('profile'));
        expect(
            result.current.windows.find((window) => window.key === 'profile'),
        ).toMatchObject({
            maximized: true,
            minimized: false,
        });
    });

    it('keeps moved windows inside viewport bounds', () => {
        const { result } = renderHook(() => useWindowManager());

        Object.defineProperty(window, 'innerWidth', {
            value: 900,
            configurable: true,
        });
        Object.defineProperty(window, 'innerHeight', {
            value: 700,
            configurable: true,
        });

        act(() => result.current.move('profile', -100, -100));
        expect(
            result.current.windows.find((window) => window.key === 'profile'),
        ).toMatchObject({
            x: 152,
            y: 64,
        });
    });
});
