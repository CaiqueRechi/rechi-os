import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OsWindow } from '@/components/rechi-os/os-window';
import type { DesktopWindow } from '@/hooks/use-window-manager';

const windowState: DesktopWindow = {
    key: 'profile',
    title: 'PROFILE',
    x: 160,
    y: 90,
    width: 420,
    height: 260,
    closed: false,
    minimized: false,
    maximized: false,
    z: 8,
};

describe('OsWindow', () => {
    it('renders controls and body content', () => {
        render(
            <OsWindow
                windowState={windowState}
                active
                onFocus={vi.fn()}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onMaximize={vi.fn()}
                onMove={vi.fn()}
                onResize={vi.fn()}
            >
                <p>Profile content</p>
            </OsWindow>,
        );

        expect(screen.getByLabelText('PROFILE window')).toBeInTheDocument();
        expect(screen.getByText('Profile content')).toBeInTheDocument();
    });

    it('minimizes from the title bar control', async () => {
        const minimize = vi.fn();

        render(
            <OsWindow
                windowState={windowState}
                active
                onFocus={vi.fn()}
                onMinimize={minimize}
                onClose={vi.fn()}
                onMaximize={vi.fn()}
                onMove={vi.fn()}
                onResize={vi.fn()}
            >
                <p>Profile content</p>
            </OsWindow>,
        );

        await userEvent.click(screen.getByLabelText('Minimize PROFILE'));

        expect(minimize).toHaveBeenCalledWith('profile');
    });

    it('closes from the title bar control without starting a drag', async () => {
        const close = vi.fn();
        const focus = vi.fn();

        render(
            <OsWindow
                windowState={windowState}
                active
                onFocus={focus}
                onMinimize={vi.fn()}
                onClose={close}
                onMaximize={vi.fn()}
                onMove={vi.fn()}
                onResize={vi.fn()}
            >
                <p>Profile content</p>
            </OsWindow>,
        );

        await userEvent.click(screen.getByLabelText('Close PROFILE'));

        expect(close).toHaveBeenCalledWith('profile');
        expect(focus).not.toHaveBeenCalled();
    });

    it('maximizes and supports pointer dragging', async () => {
        const maximize = vi.fn();
        const move = vi.fn();
        const focus = vi.fn();

        render(
            <OsWindow
                windowState={windowState}
                active
                onFocus={focus}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onMaximize={maximize}
                onMove={move}
                onResize={vi.fn()}
            >
                <p>Profile content</p>
            </OsWindow>,
        );

        await userEvent.click(screen.getByLabelText('Maximize PROFILE'));
        expect(maximize).toHaveBeenCalledWith('profile');

        const titleBar = screen.getByText('PROFILE')
            .parentElement as HTMLElement;
        fireEvent.pointerDown(titleBar, {
            clientX: 180,
            clientY: 110,
            pointerId: 1,
        });
        fireEvent.pointerMove(titleBar, {
            clientX: 220,
            clientY: 140,
            pointerId: 1,
        });
        fireEvent.pointerUp(titleBar, { pointerId: 1 });

        expect(focus).toHaveBeenCalledWith('profile');
        expect(move).toHaveBeenCalledWith('profile', 200, 120);
    });

    it('resizes from the southeast handle', () => {
        const resize = vi.fn();
        const focus = vi.fn();

        render(
            <OsWindow
                windowState={windowState}
                active
                onFocus={focus}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onMaximize={vi.fn()}
                onMove={vi.fn()}
                onResize={resize}
            >
                <p>Profile content</p>
            </OsWindow>,
        );

        const handle = screen.getByLabelText('Resize PROFILE se');
        fireEvent.pointerDown(handle, {
            clientX: 580,
            clientY: 350,
            pointerId: 1,
        });
        fireEvent.pointerMove(handle, {
            clientX: 640,
            clientY: 390,
            pointerId: 1,
        });
        fireEvent.pointerUp(handle, { pointerId: 1 });

        expect(focus).toHaveBeenCalledWith('profile');
        expect(resize).toHaveBeenCalledWith('profile', {
            height: 300,
            width: 480,
            x: 160,
            y: 90,
        });
    });

    it('does not render minimized windows', () => {
        render(
            <OsWindow
                windowState={{ ...windowState, minimized: true }}
                active={false}
                onFocus={vi.fn()}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onMaximize={vi.fn()}
                onMove={vi.fn()}
                onResize={vi.fn()}
            >
                <p>Hidden content</p>
            </OsWindow>,
        );

        expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });

    it('does not render closed windows', () => {
        render(
            <OsWindow
                windowState={{ ...windowState, closed: true }}
                active={false}
                onFocus={vi.fn()}
                onMinimize={vi.fn()}
                onClose={vi.fn()}
                onMaximize={vi.fn()}
                onMove={vi.fn()}
                onResize={vi.fn()}
            >
                <p>Closed content</p>
            </OsWindow>,
        );

        expect(screen.queryByText('Closed content')).not.toBeInTheDocument();
    });
});
