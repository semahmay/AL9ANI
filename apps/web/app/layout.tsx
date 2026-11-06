import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Al9ani — Local bookings across Tunisia',
  description:
    'Al9ani is building a simple booking platform for Tunisian salons, studios, courts, and local experiences.',
  applicationName: 'Al9ani',
  openGraph: {
    title: 'Al9ani — Local bookings across Tunisia',
    description:
      'Discover and book beauty, wellness, and sport experiences across Tunisia. Currently in development.',
    type: 'website',
    locale: 'en_TN',
    siteName: 'Al9ani',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f3d33',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
