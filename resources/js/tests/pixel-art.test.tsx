import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PixelAvatar, PixelSalem } from '@/components/rechi-os/pixel-art';

describe('pixel art', () => {
    it('renders accessible avatar and salem assets', () => {
        render(
            <>
                <PixelAvatar />
                <PixelSalem />
            </>,
        );

        expect(
            screen.getByLabelText('Pixel art avatar of Caique Rechi'),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('Salem, black pixel art cat'),
        ).toBeInTheDocument();
    });
});
