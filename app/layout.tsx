import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://motorolarepairparts.com'),
  title: {
    default: 'Motorola Repair Parts | 300 Repair and Sourcing Guides',
    template: '%s | Motorola Repair Parts',
  },
  description: 'Explore 300 Motorola model-and-component repair guides, California right-to-repair resources, and direct current Parts4Cells category links.',
  icons: { icon: '/og.png' },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Motorola Repair Parts',
    description: 'Motorola repair decision guides, model identification, parts sourcing, and California right-to-repair resources.',
    siteName: 'Motorola Repair Parts',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Motorola Repair Parts, 300 model-and-component repair guides' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Motorola Repair Parts',
    description: '300 Motorola model-and-component repair guides with direct current parts-category links.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
