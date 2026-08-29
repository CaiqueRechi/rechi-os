import { useCallback, useMemo, useState } from 'react';

export type WindowKey =
    | 'profile'
    | 'projects'
    | 'terminal'
    | 'experience'
    | 'stack'
    | 'contact'
    | 'assistant';

export type DesktopWindow = {
    key: WindowKey;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    closed: boolean;
    minimized: boolean;
    maximized: boolean;
    z: number;
};

export type WindowRect = Pick<DesktopWindow, 'height' | 'width' | 'x' | 'y'>;

const initialWindows: DesktopWindow[] = [
    {
        key: 'profile',
        title: 'PROFILE',
        x: 220,
        y: 128,
        width: 760,
        height: 460,
        closed: false,
        minimized: false,
        maximized: false,
        z: 2,
    },
    {
        key: 'projects',
        title: 'PROJECTS',
        x: 1030,
        y: 230,
        width: 420,
        height: 390,
        closed: false,
        minimized: false,
        maximized: false,
        z: 3,
    },
    {
        key: 'terminal',
        title: 'TERMINAL',
        x: 220,
        y: 620,
        width: 560,
        height: 190,
        closed: false,
        minimized: false,
        maximized: false,
        z: 4,
    },
    {
        key: 'experience',
        title: 'EXPERIENCE',
        x: 260,
        y: 180,
        width: 680,
        height: 370,
        closed: false,
        minimized: true,
        maximized: false,
        z: 1,
    },
    {
        key: 'stack',
        title: 'STACK',
        x: 990,
        y: 640,
        width: 430,
        height: 260,
        closed: false,
        minimized: true,
        maximized: false,
        z: 1,
    },
    {
        key: 'contact',
        title: 'CONTACT',
        x: 880,
        y: 160,
        width: 470,
        height: 420,
        closed: false,
        minimized: true,
        maximized: false,
        z: 1,
    },
    {
        key: 'assistant',
        title: 'ASK RECHI',
        x: 1120,
        y: 110,
        width: 420,
        height: 260,
        closed: false,
        minimized: true,
        maximized: false,
        z: 1,
    },
];

export function useWindowManager() {
    const [windows, setWindows] = useState(initialWindows);
    const topZ = useMemo(() => {
        const visibleWindows = windows.filter(
            (window) => !window.closed && !window.minimized,
        );

        return visibleWindows.length > 0
            ? Math.max(...visibleWindows.map((window) => window.z))
            : 0;
    }, [windows]);

    const focus = useCallback((key: WindowKey) => {
        setWindows((current) =>
            current.map((window) =>
                window.key === key
                    ? {
                          ...window,
                          closed: false,
                          minimized: false,
                          z: Math.max(...current.map((item) => item.z)) + 1,
                      }
                    : window,
            ),
        );
    }, []);

    const minimize = useCallback((key: WindowKey) => {
        setWindows((current) =>
            current.map((window) =>
                window.key === key ? { ...window, minimized: true } : window,
            ),
        );
    }, []);

    const close = useCallback((key: WindowKey) => {
        setWindows((current) =>
            current.map((window) =>
                window.key === key
                    ? { ...window, closed: true, minimized: false }
                    : window,
            ),
        );
    }, []);

    const toggleMaximize = useCallback((key: WindowKey) => {
        setWindows((current) =>
            current.map((window) =>
                window.key === key
                    ? {
                          ...window,
                          minimized: false,
                          maximized: !window.maximized,
                          z: Math.max(...current.map((item) => item.z)) + 1,
                      }
                    : window,
            ),
        );
    }, []);

    const move = useCallback((key: WindowKey, x: number, y: number) => {
        const maxX = Math.max(0, window.innerWidth - 280);
        const maxY = Math.max(56, window.innerHeight - 120);

        setWindows((current) =>
            current.map((item) =>
                item.key === key
                    ? {
                          ...item,
                          x: Math.min(Math.max(152, x), maxX),
                          y: Math.min(Math.max(64, y), maxY),
                      }
                    : item,
            ),
        );
    }, []);

    const resize = useCallback((key: WindowKey, rect: WindowRect) => {
        setWindows((current) =>
            current.map((item) =>
                item.key === key
                    ? {
                          ...item,
                          ...rect,
                          maximized: false,
                          z: Math.max(...current.map((window) => window.z)) + 1,
                      }
                    : item,
            ),
        );
    }, []);

    return {
        windows,
        topZ,
        focus,
        minimize,
        close,
        toggleMaximize,
        move,
        resize,
    };
}
