'use client'

import { ArrowRight, LoaderCircle, MessageCircle, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  full_name: string
  bio: string | null
  avatar_url: string | null
}

type FriendRequest = {
  id: string
  sender_id: string
  receiver_id: string
  created_at: string
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'S'
}

export function FriendsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [friends, setFriends] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        window.location.replace('/auth/login')
        return
      }

      const id = auth.user.id
      setUserId(id)

      const { data: requests, error: requestError } = await supabase
        .from('swap_requests')
        .select('id, sender_id, receiver_id, created_at')
        .eq('status', 'ACCEPTED')
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .order('created_at', { ascending: false })

      if (requestError) {
        if (active) { setError(requestError.message); setLoading(false) }
        return
      }

      const rows = (requests ?? []) as FriendRequest[]
      const friendIds = [...new Set(rows.map((request) => request.sender_id === id ? request.receiver_id : request.sender_id))]

      if (!friendIds.length) {
        if (active) { setFriends([]); setLoading(false) }
        return
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, bio, avatar_url')
        .in('id', friendIds)

      if (profileError) {
        if (active) { setError(profileError.message); setLoading(false) }
        return
      }

      const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile as Person]))
      if (active) {
        setFriends(friendIds.map((friendId) => byId.get(friendId)).filter((person): person is Person => Boolean(person)))
        setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [supabase])

  return (
    <div className="app-page-shell">
      <AppSidebar />
      <main className="v1-content">
        <div className="v1-top">
          <div>
            <p className="section-kicker">YOUR COMMUNITY</p>
            <h1>Friends</h1>
            <p>People you have connected with on SkillSwap. Friends no longer appear in Explore.</p>
          </div>
          <a className="v1-button primary" href="/explore"><UsersRound size={15} /> Find people</a>
        </div>

        {error && <div className="explore-alert error">{error}</div>}

        <section className="v1-card v1-card-pad">
          {loading ? (
            <div className="v1-empty"><div><LoaderCircle className="spin" size={22}/><p>Loading your friends…</p></div></div>
          ) : friends.length === 0 ? (
            <div className="v1-empty">
              <div>
                <UsersRound size={25} />
                <h3>No friends yet.</h3>
                <p>Accept a swap request to move someone from Explore into your Friends space.</p>
                <a href="/requests" className="text-link">View requests <ArrowRight size={14}/></a>
              </div>
            </div>
          ) : (
            <div className="friends-grid">
              {friends.map((friend) => (
                <article className="friend-card" key={friend.id}>
                  <div className="friend-card-top">
                    <span className="v1-avatar friend-avatar">
                      {friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : initials(friend.full_name)}
                    </span>
                    <span className="friend-status">Friend</span>
                  </div>
                  <h3>{friend.full_name}</h3>
                  <p>{friend.bio || 'SkillSwap community member'}</p>
                  <div className="friend-card-actions">
                    <a className="v1-button" href={`/people/${friend.id}`}>Profile <ArrowRight size={14} /></a>
                    <a className="v1-button primary" href={`/messages?friend=${encodeURIComponent(friend.id)}`}><MessageCircle size={14} /> Message</a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
