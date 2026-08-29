import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AppLogoIcon from '@/components/app-logo-icon';
import BrandLogo from '@/components/brand-logo';

describe('AppLogoIcon', () => {
    it('renders the Rechi OS terminal mark', () => {
        render(<AppLogoIcon />);

        const logo = screen.getByRole('img', { name: 'Rechi OS' });

        expect(logo).toHaveAttribute('src', '/icon.svg');
    });

    it('renders the full Rechi OS brand on authentication screens', () => {
        render(<BrandLogo />);

        expect(screen.getByRole('img', { name: 'Rechi OS' })).toHaveAttribute(
            'src',
            '/logo.svg',
        );
    });
});
