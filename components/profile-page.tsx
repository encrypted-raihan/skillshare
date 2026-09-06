
'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, ChevronRight, ImagePlus, LoaderCircle, LogOut, Trash2, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  full_name: string
  bio: string | null
  avatar_url: string | null
}

type Skill = {
  id: string
  name: string
}

type UserSkill = {
  skill_id: string
  skill_type: 'OFFER' | 'NEED'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S'
}

export function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [skills, setSkills] = useState<string[]>([])
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (!mounted) return
      if (authError || !authData.user) {
        window.location.replace('/auth/login')
        return
      }

      const id = authData.user.id
      setUserId(id)

      const [profileResult, userSkillsResult, skillsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, bio, avatar_url').eq('id', id).maybeSingle(),
        supabase.from('user_skills').select('skill_id, skill_type').eq('user_id', id).eq('skill_type', 'OFFER'),
        supabase.from('skills').select('id, name'),
      ])

      if (!mounted) return
      if (profileResult.error || userSkillsResult.error || skillsResult.error) {
        setError((profileResult.error || userSkillsResult.error || skillsResult.error)?.message ?? 'Unable to load your profile.')
        setLoading(false)
        return
      }

      const loadedProfile = profileResult.data as Profile | null
      const skillMap = new Map((skillsResult.data as Skill[] ?? []).map((skill) => [skill.id, skill.name]))
      const offeredSkills = (userSkillsResult.data as UserSkill[] ?? [])
        .map((userSkill) => skillMap.get(userSkill.skill_id))
        .filter((skill): skill is string => Boolean(skill))

      setProfile(loadedProfile)
      setName(loadedProfile?.full_name ?? '')
      setBio(loadedProfile?.bio ?? '')
      setSkills(offeredSkills)
      setLoading(false)
    }

    loadProfile()
    return () => { mounted = false }
  }, [supabase])

  async function saveProfile() {
    if (!userId || !name.trim()) return
    setSaving(true)
    setError('')
    setMessage('')

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), bio: bio.trim() || null })
      .eq('id', userId)
      .select('id, full_name, bio, avatar_url')
      .single()

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setProfile(data as Profile)
    setName(data.full_name)
    setBio(data.bio ?? '')
    setEditing(false)
    setMessage('Profile updated.')
    setSaving(false)
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return

    setError('')
    setMessage('')
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photos must be 5 MB or smaller.')
      return
    }

    setPhotoBusy(true)
    const storagePath = `${userId}/avatar`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, { cacheControl: '3600', upsert: true, contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
      setPhotoBusy(false)
      return
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(storagePath)
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`
    const { data, error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select('id, full_name, bio, avatar_url')
      .single()

    if (profileError) {
      setError(profileError.message)
      setPhotoBusy(false)
      return
    }

    setProfile(data as Profile)
    setMessage('Profile photo updated.')
    setPhotoBusy(false)
  }

  async function removePhoto() {
    if (!userId || !profile?.avatar_url) return
    setPhotoBusy(true)
    setError('')
    setMessage('')

    const { error: removeError } = await supabase.storage.from('avatars').remove([`${userId}/avatar`])
    if (removeError && !removeError.message.toLowerCase().includes('not found')) {
      setError(removeError.message)
      setPhotoBusy(false)
      return
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)
      .select('id, full_name, bio, avatar_url')
      .single()

    if (profileError) {
      setError(profileError.message)
      setPhotoBusy(false)
      return
    }

    setProfile(data as Profile)
    setMessage('Profile photo removed. Your initial is back.')
    setPhotoBusy(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  if (loading) {
    return <main className="profile-page"><div className="profile-loading"><LoaderCircle className="spin" size={22} /> Loading your profile…</div></main>
  }

  if (!profile) {
    return <main className="profile-page"><div className="profile-error-card"><UserRound size={24} /><h1>Profile unavailable</h1><p>{error || 'We could not find your profile.'}</p><a href="/explore" className="profile-primary-button">Back to Explore</a></div></main>
  }

  return (
    <main className="profile-page">
      <div className="profile-orb profile-orb-one" />
      <div className="profile-orb profile-orb-two" />

      <header className="profile-header">
        <a href="/explore" className="profile-back"><ArrowLeft size={17} /> Back to Explore</a>
        <div className="profile-brand"><span className="explore-logo-mark"><span /><span /><span /><span /></span><strong>SkillSwap</strong></div>
        <button type="button" className="profile-signout" onClick={signOut}><LogOut size={15} /> Sign out</button>
      </header>

      <section className="profile-layout">
        <div className="profile-main-card">
          <div className="profile-cover">
            <div className="profile-cover-glow" />
            <div className="profile-avatar-wrap">
              <div className="profile-avatar-large">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={`${profile.full_name} profile`} /> : <span>{initials(profile.full_name)}</span>}
              </div>
              <button type="button" className="profile-camera-button" onClick={() => fileInputRef.current?.click()} disabled={photoBusy} aria-label="Change profile photo">
                {photoBusy ? <LoaderCircle className="spin" size={15} /> : <Camera size={15} />}
              </button>
            </div>
          </div>

          <div className="profile-details">
            <div className="profile-title-row">
              <div>
                <p className="section-kicker">YOUR PROFILE</p>
                <h1>{profile.full_name}</h1>
                <p className="profile-subtitle">A SkillSwap community member</p>
              </div>
              <button type="button" className="profile-edit-button" onClick={() => setEditing((value) => !value)}>{editing ? <X size={15} /> : <UserRound size={15} />} {editing ? 'Cancel' : 'Edit profile'}</button>
            </div>

            {error && <div className="profile-alert error">{error}</div>}
            {message && <div className="profile-alert success"><Check size={14} /> {message}</div>}

            {editing ? (
              <div className="profile-edit-form">
                <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label>
                <label>Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} maxLength={300} placeholder="Tell people a little about yourself…" /></label>
                <button type="button" className="profile-primary-button" disabled={saving || !name.trim()} onClick={saveProfile}>{saving ? 'Saving…' : 'Save changes'} <ChevronRight size={16} /></button>
              </div>
            ) : (
              <div className="profile-bio">
                <p>{profile.bio || 'Add a short introduction so people know who they are connecting with.'}</p>
              </div>
            )}

            <div className="profile-section-divider" />

            <section className="profile-skills-section">
              <div className="profile-section-heading"><div><p className="section-kicker">WHAT YOU SHARE</p><h2>Your skills</h2></div><a href="/profile/skills">Manage skills <ChevronRight size={14} /></a></div>
              {skills.length ? <div className="profile-skill-list">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : <div className="profile-empty-skills"><ImagePlus size={18} /><p>No skills added yet.</p><a href="/profile/skills">Add your first skill</a></div>}
            </section>
          </div>
        </div>

        <aside className="profile-side-column">
          <section className="profile-side-card photo-card">
            <div className="profile-section-heading"><div><p className="section-kicker">PROFILE PHOTO</p><h2>Make it yours.</h2></div><span className="photo-status">{profile.avatar_url ? 'Added' : 'Initial'}</span></div>
            <p>Use a photo or keep the simple SkillSwap initial avatar. You can change it whenever you like.</p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadPhoto} hidden />
            <button type="button" className="profile-upload-button" onClick={() => fileInputRef.current?.click()} disabled={photoBusy}><Camera size={16} /> {photoBusy ? 'Updating…' : profile.avatar_url ? 'Change photo' : 'Upload photo'}</button>
            {profile.avatar_url && <button type="button" className="profile-remove-button" onClick={removePhoto} disabled={photoBusy}><Trash2 size={15} /> Remove photo</button>}
            <small>JPG, PNG, WEBP or GIF · max 5 MB</small>
          </section>

          <section className="profile-side-card initial-card">
            <div className="initial-preview"><span>{initials(profile.full_name)}</span></div>
            <div><p className="section-kicker">NO PHOTO?</p><h2>Your initial works.</h2><p>If you remove your photo, <strong>{initials(profile.full_name)}</strong> becomes your avatar automatically.</p></div>
          </section>
        </aside>
      </section>
    </main>
  )
}
