'use client'

import { Compass, MessageCircle, Send, UsersRound } from 'lucide-react'
import { usePathname } from 'next/navigation'
import styles from './mobile-bottom-nav.module.css'

const items = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/requests', label: 'Requests', icon: Send },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/friends', label: 'Friends', icon: UsersRound },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.dock} aria-label="Mobile navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/explore' && pathname.startsWith(`${href}/`))

        return (
          <a
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`${styles.item} ${active ? styles.itemActive : ''}`}
          >
            <span className={styles.iconWrap}>
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
            </span>
            <span>{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
