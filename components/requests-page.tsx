'use client'

import { Check, ChevronRight, LoaderCircle, Send, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type RequestRow = {
  id: string
  sender_id: string
  receiver_id: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'
  created_at: string
  updated_at: string
}

type Person = { id: string; full_name: string; bio: string | null; avatar_url: string | null }

function initials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'S' }

export function RequestsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [tab, setTab] = useState<'incoming'|'outgoing'|'history'>('incoming')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { window.location.replace('/auth/login'); return }
    const id = auth.user.id; setUserId(id)
    const { data, error: requestError } = await supabase.from('swap_requests').select('*').or(`sender_id.eq.${id},receiver_id.eq.${id}`).order('created_at', { ascending: false })
    if (requestError) { setError(requestError.message); setLoading(false); return }
    const rows = (data ?? []) as RequestRow[]
    const ids = [...new Set(rows.flatMap((r) => [r.sender_id, r.receiver_id]).filter((x) => x !== id))]
    if (ids.length) {
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name, bio, avatar_url').in('id', ids)
      if (profilesError) { setError(profilesError.message); setLoading(false); return }
      const map: Record<string, Person> = {}; (profiles ?? []).forEach((p) => { map[p.id] = p as Person }); setPeople(map)
    } else setPeople({})
    setRequests(rows); setLoading(false)
  }

  useEffect(() => { load() }, [supabase])

  async function respond(id: string, action: 'ACCEPT'|'DECLINE'|'CANCEL') {
    setBusy(id); setError('')
    const { error: actionError } = await supabase.rpc('respond_to_swap_request', { request_id: id, action })
    if (actionError) setError(actionError.message)
    else await load()
    setBusy(null)
  }

  const visible = requests.filter((r) => {
    if (tab === 'incoming') return r.receiver_id === userId && r.status === 'PENDING'
    if (tab === 'outgoing') return r.sender_id === userId && r.status === 'PENDING'
    return r.status !== 'PENDING'
  })

  return <div className="app-page-shell"><AppSidebar /><main className="v1-content">
    <div className="v1-top"><div><p className="section-kicker">YOUR CONNECTIONS</p><h1>Swap requests</h1><p>Accept the people you want to learn with. Decline or cancel anything that isn't a fit.</p></div><a className="v1-button primary" href="/explore"><Send size={15}/> Explore people</a></div>
    <div className="v1-tabs"><button className={`v1-tab ${tab==='incoming'?'active':''}`} onClick={() => setTab('incoming')}>Incoming</button><button className={`v1-tab ${tab==='outgoing'?'active':''}`} onClick={() => setTab('outgoing')}>Outgoing</button><button className={`v1-tab ${tab==='history'?'active':''}`} onClick={() => setTab('history')}>History</button></div>
    {error && <div className="explore-alert error">{error}</div>}
    <section className="v1-card v1-card-pad">
      {loading ? <div className="v1-empty"><div><LoaderCircle className="spin" size={22}/><p>Loading requests…</p></div></div> : visible.length === 0 ? <div className="v1-empty"><div><Send size={24}/><h3>No requests here yet.</h3><p>When someone wants to swap skills with you, their request will show up in this space.</p><a href="/explore" className="text-link">Go discover people <ChevronRight size={14}/></a></div></div> : <div className="v1-list">{visible.map((request) => { const otherId = request.sender_id === userId ? request.receiver_id : request.sender_id; const person = people[otherId]; const incoming = request.receiver_id === userId; return <article className="v1-item request-clickable" key={request.id} role="link" tabIndex={0} onClick={() => { window.location.assign(`/people/${otherId}`) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.location.assign(`/people/${otherId}`) } }}><span className="v1-avatar">{person?.avatar_url ? <img src={person.avatar_url} alt=""/> : initials(person?.full_name ?? 'SkillSwap member')}</span><div className="v1-item-main"><h3>{person?.full_name ?? 'SkillSwap member'}</h3><p>{person?.bio || (incoming ? 'Wants to connect with you for a skill swap.' : 'Waiting for them to respond to your swap request.')}</p><small className="small-muted">{request.status} · {new Date(request.created_at).toLocaleDateString()}</small></div><div className="v1-actions">{request.status === 'PENDING' && incoming && <><button className="v1-button primary" disabled={busy===request.id} onClick={(event) => { event.stopPropagation(); respond(request.id,'ACCEPT') }}>{busy===request.id ? 'Working…' : <><Check size={14}/> Accept</>}</button><button className="v1-button danger" disabled={busy===request.id} onClick={(event) => { event.stopPropagation(); respond(request.id,'DECLINE') }}><X size={14}/> Decline</button></>}{request.status === 'PENDING' && !incoming && <button className="v1-button" disabled={busy===request.id} onClick={(event) => { event.stopPropagation(); respond(request.id,'CANCEL') }}>{busy===request.id ? 'Cancelling…' : 'Cancel request'}</button>}{request.status==='ACCEPTED' && <a className="v1-button primary" href="/messages">Message <ChevronRight size={14}/></a>}</div></article>})}</div>}
    </section>
  </main></div>
}
