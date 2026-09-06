'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, CalendarDays, ImagePlus, X } from 'lucide-react'
import { emptyOnboardingDraft, readDraft, readPendingAvatar, readTemporaryPassword, writeDraft, writePendingAvatar } from '@/lib/onboarding'
import '../onboarding.css'

export default function ProfileOnboardingPage() {
  const [draft, setDraft] = useState(emptyOnboardingDraft)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarBusy, setAvatarBusy] = useState(false)

  useEffect(() => {
    const savedDraft = readDraft()
    const temporaryPassword = readTemporaryPassword()
    if (!savedDraft.accountEmail || !temporaryPassword) {
      window.location.replace('/auth/sign-up')
      return
    }
    setDraft(savedDraft)
    setAvatarPreview(readPendingAvatar())
    setReady(true)
  }, [])

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photos must be 5 MB or smaller.')
      return
    }

    setAvatarBusy(true)
    try {
      const preview = await new Promise<string>((resolve, reject) => {
        const image = new Image()
        const reader = new FileReader()
        reader.onload = () => { image.src = String(reader.result) }
        reader.onerror = () => reject(new Error('We could not read that image.'))
        image.onload = () => {
          const maxSize = 640
          const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
          const context = canvas.getContext('2d')
          if (!context) return reject(new Error('Your browser could not prepare the image.'))
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.78))
        }
        image.onerror = () => reject(new Error('That image could not be processed.'))
        reader.readAsDataURL(file)
      })
      writePendingAvatar(preview)
      setAvatarPreview(preview)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not prepare that photo.')
    } finally {
      setAvatarBusy(false)
    }
  }

  function skipAvatar() {
    try { window.localStorage.removeItem('skillswap:onboarding-avatar:v1') } catch {}
    setAvatarPreview('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const fullName = draft.fullName.trim()
    const phoneNumber = draft.phoneNumber.trim()
    if (fullName.length < 2) return setError('Tell us your name so people know who they are learning with.')
    if (!/^\+?[0-9 ()-]{8,20}$/.test(phoneNumber)) return setError('Enter a valid phone number.')
    if (!draft.dateOfBirth) return setError('Choose your date of birth.')
    const age = new Date().getFullYear() - new Date(`${draft.dateOfBirth}T00:00:00`).getFullYear()
    if (age < 13) return setError('SkillSwap is for people aged 13 and above.')

    const nextDraft = { ...draft, fullName, phoneNumber, bio: draft.bio.trim() }
    writeDraft(nextDraft)
    window.location.assign('/onboarding/skills')
  }

  if (!ready) {
    return <main className="onboarding-page"><div className="onboarding-shell"><section className="onboarding-card"><div className="loading">Preparing your profile…</div></section></div></main>
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <a className="onboarding-brand" href="/auth/sign-up">
            <img className="onboarding-logo" src="/onboarding/logo.webp" alt="SkillSwap" />
            <span>SkillSwap</span>
          </a>
          <span className="onboarding-step">About you · 02 / 03</span>
        </header>

        <section className="onboarding-card">
          <div className="onboarding-content">
            <div className="onboarding-content-inner">
              <div className="onboarding-progress">
                <div className="onboarding-progress-track"><div className="onboarding-progress-fill" style={{ width: '66%' }} /></div>
                <span className="onboarding-progress-label">02 / 03</span>
              </div>

              <p className="onboarding-eyebrow">MAKE IT HUMAN</p>
              <h1 className="onboarding-title">Tell us about you.</h1>
              <p className="onboarding-description">Just enough context for people to understand who they could learn with. Keep it real, keep it simple.</p>

              <form className="onboarding-form" onSubmit={handleSubmit}>
                <div className="onboarding-form-grid">
                  <div className="onboarding-field full">
                    <label className="onboarding-label" htmlFor="fullName">Full name</label>
                    <input className="onboarding-input" id="fullName" value={draft.fullName} onChange={e => setDraft({ ...draft, fullName: e.target.value })} placeholder="Alex Morgan" autoComplete="name" required />
                  </div>

                  <div className="onboarding-field full onboarding-avatar-field">
                    <div className="onboarding-label">
                      <span>Profile photo</span>
                      <span className="onboarding-hint">optional</span>
                    </div>
                    <div className="onboarding-avatar-picker">
                      <div className="onboarding-avatar-preview">
                        {avatarPreview ? <img src={avatarPreview} alt="Profile preview" /> : <span><ImagePlus size={22} /></span>}
                      </div>
                      <div className="onboarding-avatar-copy">
                        <strong>{avatarPreview ? 'Looking good.' : 'Add a photo people can recognise.'}</strong>
                        <span>{avatarPreview ? 'You can change it or remove it before continuing.' : 'A clear face photo helps people connect with you. You can skip this.'}</span>
                        <div className="onboarding-avatar-actions">
                          <label className="onboarding-photo-button">
                            <Camera size={14} /> {avatarBusy ? 'Preparing…' : avatarPreview ? 'Change photo' : 'Add photo'}
                            <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarBusy} hidden />
                          </label>
                          {avatarPreview && <button type="button" className="onboarding-photo-remove" onClick={skipAvatar} disabled={avatarBusy}><X size={14} /> Remove</button>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="onboarding-field">
                    <label className="onboarding-label" htmlFor="phoneNumber">Phone number</label>
                    <input className="onboarding-input" id="phoneNumber" value={draft.phoneNumber} onChange={e => setDraft({ ...draft, phoneNumber: e.target.value })} placeholder="+91 98765 43210" autoComplete="tel" required />
                  </div>

                  <div className="onboarding-field">
                    <label className="onboarding-label" htmlFor="dateOfBirth">Date of birth</label>
                    <div className="onboarding-date">
                      <CalendarDays size={16} aria-hidden />
                      <input className="onboarding-input" id="dateOfBirth" type="date" value={draft.dateOfBirth} onChange={e => setDraft({ ...draft, dateOfBirth: e.target.value })} required />
                    </div>
                  </div>

                  <div className="onboarding-field full">
                    <label className="onboarding-label" htmlFor="bio">
                      <span>A little about you</span>
                      <span className="onboarding-hint">optional · {draft.bio.length}/400</span>
                    </label>
                    <textarea className="onboarding-textarea" id="bio" value={draft.bio} maxLength={400} onChange={e => setDraft({ ...draft, bio: e.target.value })} placeholder="What do you enjoy? What are you building?" />
                  </div>
                </div>

                {error && <div className="onboarding-error" role="alert">{error}</div>}

                <div className="onboarding-actions">
                  <a className="onboarding-link-button onboarding-secondary" href="/auth/sign-up"><ArrowLeft size={16} /> Back</a>
                  <button className="onboarding-button onboarding-primary" type="submit">Continue <ArrowRight size={17} /></button>
                </div>
              </form>
            </div>
          </div>

          <aside className="onboarding-visual">
            <img className="onboarding-art" src="/onboarding/5.webp" alt="" width={620} height={520} />
            <div className="onboarding-visual-copy">
              
              <p>A little context helps the right people understand what it would feel like to learn with you.</p>
              <div className="onboarding-mini-dots" aria-hidden="true"><span /><span className="active" /><span /></div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
