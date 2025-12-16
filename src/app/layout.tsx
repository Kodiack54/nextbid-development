import type { Metadata } from 'next';
import './globals.css';
import { UserProvider } from './contexts/UserContext';
import { BuildVersion } from '@/components/BuildVersion';

export const metadata: Metadata = {
  title: "Kodiack Studio's",
  description: 'Development environment with Claude AI',
  icons: {
    icon: '/images/nextbid-logo.png',
    apple: '/images/nextbid-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white antialiased">
        <UserProvider>
          {children}
          <BuildVersion />
        </UserProvider>
      </body>
    </html>
  );
}
