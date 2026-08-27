import { Minus, Square, X } from 'lucide-react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useRef } from 'react';

import type {
    DesktopWindow,
    WindowKey,
    WindowRect,
} from '@/hooks/use-window-manager';

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

type OsWindowProps = {
    windowState: DesktopWindow;
    children: ReactNode;
    active: boolean;
    onFocus: (key: WindowKey) => void;
    onMinimize: (key: WindowKey) => void;
    onMaximize: (key: WindowKey) => void;
    onMove: (key: WindowKey, x: number, y: number) => void;
    onResize: (key: WindowKey, rect: WindowRect) => void;
};

const minSize = {
    height: 180,
    width: 320,
};

const resizeDirections: ResizeDirection[] = [
    'n',
    'ne',
    'e',
    'se',
    's',
    'sw',
    'w',
    'nw',
];

export function OsWindow({
    windowState,
    children,
    active,
    onFocus,
    onMinimize,
    onMaximize,
    onMove,
    onResize,
}: OsWindowProps) {
    const dragOffset = useRef({ x: 0, y: 0 });
    const dragging = useRef(false);
    const resizing = useRef<{
        direction: ResizeDirection;
        pointerX: number;
        pointerY: number;
        rect: WindowRect;
    } | null>(null);

    if (windowState.minimized) {
        return null;
    }

    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (windowState.maximized) {
            return;
        }

        onFocus(windowState.key);
        dragOffset.current = {
            x: event.clientX - windowState.x,
            y: event.clientY - windowState.y,
        };
        dragging.current = true;

        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    };

    const drag = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragging.current) {
            return;
        }

        onMove(
            windowState.key,
            event.clientX - dragOffset.current.x,
            event.clientY - dragOffset.current.y,
        );
    };

    const endDrag = () => {
        dragging.current = false;
    };

    const startResize =
        (direction: ResizeDirection) =>
        (event: PointerEvent<HTMLButtonElement>) => {
            if (windowState.maximized) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            onFocus(windowState.key);
            resizing.current = {
                direction,
                pointerX: event.clientX,
                pointerY: event.clientY,
                rect: {
                    height: windowState.height,
                    width: windowState.width,
                    x: windowState.x,
                    y: windowState.y,
                },
            };

            if (event.currentTarget.setPointerCapture) {
                event.currentTarget.setPointerCapture(event.pointerId);
            }
        };

    const resizeWindow = (event: PointerEvent<HTMLButtonElement>) => {
        if (!resizing.current) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const { direction, pointerX, pointerY, rect } = resizing.current;
        const deltaX = event.clientX - pointerX;
        const deltaY = event.clientY - pointerY;
        const desktopBounds = {
            bottom: Math.max(64 + minSize.height, window.innerHeight - 20),
            left: 152,
            right: Math.max(152 + minSize.width, window.innerWidth - 20),
            top: 58,
        };

        let nextX = rect.x;
        let nextY = rect.y;
        let nextWidth = rect.width;
        let nextHeight = rect.height;

        if (direction.includes('e')) {
            nextWidth = Math.min(
                Math.max(minSize.width, rect.width + deltaX),
                desktopBounds.right - rect.x,
            );
        }

        if (direction.includes('s')) {
            nextHeight = Math.min(
                Math.max(minSize.height, rect.height + deltaY),
                desktopBounds.bottom - rect.y,
            );
        }

        if (direction.includes('w')) {
            const rightEdge = rect.x + rect.width;
            nextX = Math.min(
                Math.max(desktopBounds.left, rect.x + deltaX),
                rightEdge - minSize.width,
            );
            nextWidth = rightEdge - nextX;
        }

        if (direction.includes('n')) {
            const bottomEdge = rect.y + rect.height;
            nextY = Math.min(
                Math.max(desktopBounds.top, rect.y + deltaY),
                bottomEdge - minSize.height,
            );
            nextHeight = bottomEdge - nextY;
        }

        onResize(windowState.key, {
            height: nextHeight,
            width: nextWidth,
            x: nextX,
            y: nextY,
        });
    };

    const endResize = (event: PointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        resizing.current = null;
    };

    const style: CSSProperties = windowState.maximized
        ? { inset: '58px 20px 20px 164px', zIndex: windowState.z }
        : {
              left: windowState.x,
              top: windowState.y,
              width: windowState.width,
              height: windowState.height,
              zIndex: windowState.z,
          };

    return (
        <section
            className={`os-window ${active ? 'is-active' : ''} ${windowState.maximized ? 'is-maximized' : ''}`}
            style={style}
            onMouseDown={() => onFocus(windowState.key)}
            aria-label={`${windowState.title} window`}
        >
            <div
                className="os-window-titlebar"
                onPointerDown={startDrag}
                onPointerMove={drag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <span>{windowState.title}</span>
                <div className="window-actions">
                    <button
                        type="button"
                        aria-label={`Minimize ${windowState.title}`}
                        onClick={() => onMinimize(windowState.key)}
                    >
                        <Minus size={16} />
                    </button>
                    <button
                        type="button"
                        aria-label={`Maximize ${windowState.title}`}
                        onClick={() => onMaximize(windowState.key)}
                    >
                        <Square size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label={`Close ${windowState.title}`}
                        onClick={() => onMinimize(windowState.key)}
                    >
                        <X size={17} />
                    </button>
                </div>
            </div>
            <div className="os-window-body">{children}</div>
            {!windowState.maximized &&
                resizeDirections.map((direction) => (
                    <button
                        key={direction}
                        type="button"
                        className={`resize-handle resize-${direction}`}
                        aria-label={`Resize ${windowState.title} ${direction}`}
                        onPointerDown={startResize(direction)}
                        onPointerMove={resizeWindow}
                        onPointerUp={endResize}
                        onPointerCancel={endResize}
                    />
                ))}
        </section>
    );
}
