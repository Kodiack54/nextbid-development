import type { Metadata } from 'next';
import './globals.css';
import { UserProvider } from './contexts/UserContext';

export const metadata: Metadata = {
  title: 'NextBid Dev Environment',
  description: 'Development environment with Claude AI',
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
        </UserProvider>
      </body>
    </html>
  );
}
