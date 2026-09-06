'use client'

import { Compass, LogOut, MessageCircle, Send, Settings, UserRound, CircleHelp, UsersRound } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S'
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState('SkillSwap member')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [friendCount, setFriendCount] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!active || !data.user) return
      const userId = data.user.id
      const [profile, request, friends] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle(),
        supabase.from('swap_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'PENDING'),
        supabase.from('swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'ACCEPTED').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      ])
      if (!active) return
      setName(profile.data?.full_name ?? 'SkillSwap member')
      setAvatar(profile.data?.avatar_url ?? null)
      setPending(request.count ?? 0)
      setFriendCount(friends.count ?? 0)
    }
    load()
    return () => { active = false }
  }, [supabase, pathname])

  const nav = [
    { href: '/explore', label: 'Explore', icon: Compass },
    { href: '/requests', label: 'Requests', icon: Send, count: pending },
    { href: '/messages', label: 'Messages', icon: MessageCircle },
    { href: '/friends', label: 'Friends', icon: UsersRound, count: friendCount },
  ]

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <aside className="app-sidebar">
      <a href="/explore" className="explore-logo" aria-label="SkillSwap home">
        <span className="explore-logo-mark"><span /><span /><span /><span /></span>
        <span><strong>SkillSwap</strong><small>Learn · Teach · Grow</small></span>
      </a>
      <nav className="explore-nav" aria-label="Main navigation">
        {nav.map(({ href, label, icon: Icon, count }) => (
          <a key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`explore-nav-item ${pathname === href ? 'active' : ''}`}>
            <Icon size={18} /><span>{label}</span><span className="nav-count">{count ? count : ''}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <nav className="explore-nav explore-nav-secondary" aria-label="Secondary navigation">
        <a className="explore-nav-item" href="/help"><CircleHelp size={18} /><span>Help</span></a>
        <a className="explore-nav-item" href="/settings"><Settings size={18} /><span>Settings</span></a>
      </nav>
      <div className="sidebar-profile">
        <span className="avatar">{avatar ? <img src={avatar} alt="" /> : initials(name)}</span>
        <span><strong>{name}</strong><small>Community member</small></span>
        <button type="button" className="sidebar-logout" onClick={signOut} aria-label="Sign out"><LogOut size={15} /></button>
      </div>
    </aside>
  )
}
