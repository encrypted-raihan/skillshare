import './globals.css'
import { StartupLoader } from '@/components/startup-loader'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SkillSwap — Learn · Teach · Grow',
  description: 'Find people to learn from, share what you know, and build skills together.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StartupLoader />{children}</body></html>
}
