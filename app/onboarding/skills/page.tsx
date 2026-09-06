'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearOnboardingStorage, readDraft, readTemporaryPassword, writeDraft, type OnboardingDraft } from '@/lib/onboarding'
import '../onboarding.css'

export default function SkillsOnboardingPage() {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = readDraft()
    const password = readTemporaryPassword()
    if (!saved.accountEmail || !password || !saved.fullName) {
      window.location.replace('/auth/sign-up')
      return
    }
    setDraft(saved)
  }, [])

  const normalizedSkills = useMemo(() => draft?.offeredSkills ?? [], [draft])

  function addSkill() {
    if (!draft) return
    const skill = input.trim().replace(/\s+/g, ' ')
    if (!skill) return
    const exists = draft.offeredSkills.some(existing => existing.toLowerCase() === skill.toLowerCase())
    if (exists) return setError('That skill is already on your list.')
    if (draft.offeredSkills.length >= 10) return setError('Choose up to 10 skills.')
    const next = { ...draft, offeredSkills: [...draft.offeredSkills, skill] }
    setDraft(next)
    writeDraft(next)
    setInput('')
    setError('')
  }

  function removeSkill(skillToRemove: string) {
    if (!draft) return
    const next = { ...draft, offeredSkills: draft.offeredSkills.filter(skill => skill !== skillToRemove) }
    setDraft(next)
    writeDraft(next)
  }

  async function finish() {
    if (!draft) return
    setError('')
    if (draft.offeredSkills.length === 0) return setError('Add at least one skill you can teach.')
    const temporaryPassword = readTemporaryPassword()
    if (!temporaryPassword) return setError('Your signup session expired. Please start again.')

    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: draft.accountEmail,
        password: temporaryPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/confirmed`,
          data: {
            onboarding_completed: true,
            profile_full_name: draft.fullName,
            profile_bio: draft.bio,
            private_phone_number: draft.phoneNumber,
            private_date_of_birth: draft.dateOfBirth,
            offered_skills: normalizedSkills,
          },
        },
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('Supabase did not return a user. Please try again.')

      clearOnboardingStorage()
      if (data.session) window.location.assign('/explore')
      else window.location.assign('/auth/confirmed')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not finish creating your account.')
      setBusy(false)
    }
  }

  if (!draft) {
    return <main className="onboarding-page"><div className="onboarding-shell"><section className="onboarding-card"><div className="loading">Loading your saved details…</div></section></div></main>
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <a className="onboarding-brand" href="/onboarding/profile">
            <img className="onboarding-logo" src="/onboarding/logo.webp" alt="SkillSwap" />
            <span>SkillSwap</span>
          </a>
          <span className="onboarding-step">Your skills · 03 / 03</span>
        </header>

        <section className="onboarding-card">
          <div className="onboarding-content">
            <div className="onboarding-content-inner">
              <div className="onboarding-progress">
                <div className="onboarding-progress-track"><div className="onboarding-progress-fill" style={{ width: '100%' }} /></div>
                <span className="onboarding-progress-label">03 / 03</span>
              </div>

              <p className="onboarding-eyebrow">WHAT YOU CAN SHARE</p>
              <h1 className="onboarding-title">What do you know well?</h1>
              <p className="onboarding-description">Choose the skills you would genuinely enjoy teaching. Specific beats impressive — your useful knowledge is what makes the swap work.</p>

              <div className="onboarding-form">
                <div className="onboarding-field">
                  <label className="onboarding-label" htmlFor="skill">
                    <span>Add a skill</span>
                    <span className="onboarding-hint">{draft.offeredSkills.length}/10</span>
                  </label>
                  <div className="skills-add-row">
                    <input className="onboarding-input" id="skill" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} placeholder="e.g. UI design" autoFocus />
                    <button className="skills-add" type="button" onClick={addSkill} disabled={!input.trim() || draft.offeredSkills.length >= 10}><Plus size={16} /> Add</button>
                  </div>
                </div>

                <div className="skills-list" aria-live="polite">
                  {draft.offeredSkills.length
                    ? draft.offeredSkills.map(skill => (
                      <span className="skills-chip" key={skill}>
                        {skill}
                        <button className="skills-chip-remove" type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}><X size={12} /></button>
                      </span>
                    ))
                    : <div className="skills-empty">Your first skill is waiting above.</div>}
                </div>

                {error && <div className="onboarding-error" role="alert">{error}</div>}

                <div className="onboarding-actions">
                  <a className="onboarding-link-button onboarding-secondary" href="/onboarding/profile"><ArrowLeft size={16} /> Back</a>
                  <button className="onboarding-button onboarding-primary" type="button" onClick={finish} disabled={busy || draft.offeredSkills.length === 0}>
                    {busy ? 'Creating your account…' : <>Join SkillSwap <ArrowRight size={17} /></>}
                  </button>
                </div>
                <p className="onboarding-note">One final click and your profile is ready.</p>
              </div>
            </div>
          </div>

          <aside className="onboarding-visual">
            <img className="onboarding-art" src="/onboarding/2.webp" alt="" width={620} height={520} />
            <div className="onboarding-visual-copy">
             
              <p>The best swaps start with one skill you know well and one person who wants to learn it.</p>
              <div className="onboarding-mini-dots" aria-hidden="true"><span /><span /><span className="active" /></div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
