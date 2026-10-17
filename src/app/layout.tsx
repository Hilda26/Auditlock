import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AUDITLOCK — Scope. Evidence. Settlement.',
  description: 'Escrow for smart-contract security audits. Freeze the code, agree the scope, and settle against recorded delivery evidence.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
