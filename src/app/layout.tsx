import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Application Tracker',
  description: 'Track applications, interviews, and what actually converts.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
