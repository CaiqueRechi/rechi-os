import type { ImgHTMLAttributes } from 'react';

export default function BrandLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
    return <img src="/logo.svg" alt="Rechi OS" {...props} />;
}
