import { useState } from 'react';

const profileImages = Array.from(
    { length: 16 },
    (_, index) =>
        `/assets/profile/profile-${String(index + 1).padStart(2, '0')}.png`,
);
const salemImages = Array.from(
    { length: 6 },
    (_, index) =>
        `/assets/salem/salem-${String(index + 1).padStart(2, '0')}.png`,
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
    const [source] = useState(
        () => salemImages[Math.floor(Math.random() * salemImages.length)],
    );

    return (
        <figure className="pixel-salem" aria-label="Salem illustration">
            <img src={source} alt="" aria-hidden="true" />
        </figure>
    );
}
