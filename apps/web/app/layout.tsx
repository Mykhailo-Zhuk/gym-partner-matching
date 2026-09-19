import type { Metadata } from 'next';
import Navbar from '../components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'GymBrosUK — партнер у зал',
  description: 'Знайди партнера для тренувань: мэтчинг за ціллю, рівнем і графіком.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
