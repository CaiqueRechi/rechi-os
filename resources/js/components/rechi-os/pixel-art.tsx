import { useState } from 'react';

const profileImages = Array.from(
    { length: 16 },
    (_, index) =>
        `/assets/profile/profile-${String(index + 1).padStart(2, '0')}.png`,
);

export function PixelAvatar() {
    const [source] = useState(
        () => profileImages[Math.floor(Math.random() * profileImages.length)],
    );

    return (
        <figure
            className="pixel-avatar"
            aria-label="Avatar illustration of Caique Rechi"
        >
            <img src={source} alt="" aria-hidden="true" />
        </figure>
    );
}

export function PixelSalem() {
    return (
        <div
            className="pixel-salem"
            aria-label="Salem, black pixel art cat"
            role="img"
        >
            <span className="tail" />
            <span className="body" />
            <span className="head" />
            <span className="ear left" />
            <span className="ear right" />
            <span className="eye left" />
            <span className="eye right" />
            <span className="paw one" />
            <span className="paw two" />
        </div>
    );
}
