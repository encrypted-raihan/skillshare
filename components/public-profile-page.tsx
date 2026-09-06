'use client'

import { ArrowLeft, Check, ChevronRight, LoaderCircle, Send, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Profile = { id: string; full_name: string; bio: string | null; avatar_url: string | null; created_at: string }
type Skill = { id: string; name: string }

function initials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'S' }

export function PublicProfilePage({ profileId }: { profileId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [viewerId, setViewerId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [skills, setSkills] = useState<string[]>([])
  const [status, setStatus] = useState<string>('NONE')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { window.location.assign(`/auth/login?next=/people/${profileId}`); return }
      setViewerId(auth.user.id)
      const [profileResult, skillLinks, skillsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, bio, avatar_url, created_at').eq('id', profileId).maybeSingle(),
        supabase.from('user_skills').select('skill_id').eq('user_id', profileId).eq('skill_type', 'OFFER'),
        supabase.from('skills').select('id, name'),
      ])
      if (!active) return
      if (profileResult.error || skillLinks.error || skillsResult.error) { setError((profileResult.error || skillLinks.error || skillsResult.error)?.message ?? 'Unable to load profile.'); setLoading(false); return }
      if (!profileResult.data) { setError('This profile does not exist.'); setLoading(false); return }
      const skillMap = new Map((skillsResult.data as Skill[] ?? []).map((s) => [s.id, s.name]))
      setProfile(profileResult.data as Profile)
      setSkills((skillLinks.data ?? []).map((x) => skillMap.get(x.skill_id)).filter((x): x is string => Boolean(x)))
      if (auth.user.id !== profileId) {
        const { data: requests } = await supabase
          .from('swap_requests')
          .select('id, sender_id, receiver_id, status, created_at')
          .or(`and(sender_id.eq.${auth.user.id},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${auth.user.id})`)
          .order('created_at', { ascending: false })
          .limit(1)

        const request = requests?.[0]
        if (active) {
          setStatus(request?.status ?? 'NONE')
          setRequestId(request?.id ?? null)
        }
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [supabase, profileId])

  async function requestSwap() {
    if (!profile || !viewerId || viewerId === profile.id || busy) return
    setBusy(true); setError(''); setMessage('')
    const { error: rpcError } = await supabase.rpc('create_swap_request', { target_user_id: profile.id })
    if (rpcError) setError(rpcError.message)
    else { setStatus('PENDING'); setMessage('Swap request sent.'); }
    setBusy(false)
  }

  async function respondToRequest(action: 'ACCEPT' | 'DECLINE') {
    if (!requestId || busy) return
    setBusy(true)
    setError('')
    setMessage('')

    const { error: rpcError } = await supabase.rpc('respond_to_swap_request', {
      request_id: requestId,
      action,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setStatus(action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED')
      setMessage(action === 'ACCEPT' ? 'Swap request accepted.' : 'Swap request declined.')
    }

    setBusy(false)
  }

  if (loading) return <div className="app-page-shell"><AppSidebar/><main className="v1-content"><div className="v1-card v1-empty"><div><LoaderCircle className="spin" size={24}/><p>Loading profile…</p></div></div></main></div>
  if (!profile) return <div className="app-page-shell"><AppSidebar/><main className="v1-content"><div className="v1-card v1-empty"><div><UserRound size={25}/><h3>Profile unavailable</h3><p>{error}</p><a href="/explore" className="text-link">Back to Explore</a></div></div></main></div>
  const self = viewerId === profile.id

  return <div className="app-page-shell"><AppSidebar/><main className="v1-content">
    <div className="v1-top"><div><a href="/explore" className="profile-back"><ArrowLeft size={15}/> Back to Explore</a><p className="section-kicker" style={{marginTop:20}}>COMMUNITY PROFILE</p><h1>{profile.full_name}</h1></div>{!self && status === 'PENDING' && requestId && (
      <div className="profile-request-actions">
        <button className="v1-button primary" disabled={busy} onClick={() => respondToRequest('ACCEPT')}>
          {busy ? 'Working…' : <><Check size={15}/> Accept request</>}
        </button>
        <button className="v1-button danger" disabled={busy} onClick={() => respondToRequest('DECLINE')}>
          <X size={15}/> Decline
        </button>
      </div>
    )}
    {!self && status !== 'PENDING' && <button className="v1-button primary" disabled={busy || status==='ACCEPTED'} onClick={requestSwap}>{busy ? 'Sending…' : status==='ACCEPTED' ? 'Already connected' : status==='DECLINED' ? <><Send size={15}/> Send new request</> : <><Send size={15}/> Request swap</>}</button>}</div>
    {error && <div className="explore-alert error">{error}</div>}{message && <div className="explore-alert success"><Check size={14}/> {message}</div>}
    <div className="public-profile-grid">
      <section className="v1-card public-profile-hero"><div className="cover-decor"/><div className="public-profile-top"><div className="public-profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt={`${profile.full_name} profile`}/> : initials(profile.full_name)}</div><div><h1>{profile.full_name}</h1><p>Member since {new Date(profile.created_at).toLocaleDateString(undefined, { month:'long', year:'numeric' })}</p></div></div><p className="public-profile-bio">{profile.bio || 'This person has not added a bio yet.'}</p><div><p className="section-kicker" style={{marginTop:26}}>SKILLS THEY CAN SHARE</p><div className="public-profile-skills">{skills.length ? skills.map((skill) => <span className="public-profile-skill" key={skill}>{skill}</span>) : <span className="small-muted">No skills listed yet.</span>}</div></div></section>
      <aside className="v1-card v1-card-pad"><p className="section-kicker">NEXT STEP</p><h2 style={{margin:'6px 0 8px',fontSize:24,letterSpacing:'-.04em'}}>Make the first move.</h2><p className="small-muted">A SkillSwap request starts the connection. Once they accept, you can continue in Messages.</p>{!self && status === 'PENDING' && requestId && <div className="profile-request-panel"><strong>They want to swap skills with you.</strong><p className="small-muted">Accept to start chatting, or decline if it isn't a fit.</p><div className="profile-request-actions stacked"><button className="v1-button primary" style={{width:'100%'}} disabled={busy} onClick={() => respondToRequest('ACCEPT')}>{busy ? 'Working…' : <><Check size={14}/> Accept request</>}</button><button className="v1-button danger" style={{width:'100%'}} disabled={busy} onClick={() => respondToRequest('DECLINE')}><X size={14}/> Decline</button></div></div>} {(!self && status !== 'PENDING') && <>{status==='ACCEPTED' ? <a className="v1-button primary" style={{width:'100%',marginTop:18,justifyContent:'center'}} href="/messages">Connected — open Messages <ChevronRight size={14}/></a> : <button className="v1-button primary" style={{width:'100%',marginTop:18}} disabled={busy} onClick={requestSwap}>{status==='DECLINED' ? <><Send size={14}/> Send new request</> : <>Request a swap <Send size={14}/></>}</button>}</>} {self && <a className="v1-button primary" style={{width:'100%',marginTop:18,justifyContent:'center'}} href="/profile">Edit your profile <ChevronRight size={14}/></a>}</aside>
    </div>
  </main></div>
}
