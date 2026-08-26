import { Minus, Square, X } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';
import { useRef } from 'react';

import type { DesktopWindow, WindowKey } from '@/hooks/use-window-manager';

type OsWindowProps = {
    windowState: DesktopWindow;
    children: ReactNode;
    active: boolean;
    onFocus: (key: WindowKey) => void;
    onMinimize: (key: WindowKey) => void;
    onMaximize: (key: WindowKey) => void;
    onMove: (key: WindowKey, x: number, y: number) => void;
};

export function OsWindow({
    windowState,
    children,
    active,
    onFocus,
    onMinimize,
    onMaximize,
    onMove,
}: OsWindowProps) {
    const dragOffset = useRef({ x: 0, y: 0 });
    const dragging = useRef(false);

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

    const style = windowState.maximized
        ? { inset: '58px 20px 20px 164px', zIndex: windowState.z }
        : {
              left: windowState.x,
              top: windowState.y,
              width: windowState.width,
              minHeight: windowState.height,
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
        </section>
    );
}
