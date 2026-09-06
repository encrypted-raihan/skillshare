 'use client'

import Link from 'next/link'
import { ArrowRight, Check, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PasswordField } from './password-field'

type DraftAccount = {
  email: string
  password: string
}

const DRAFT_KEY = 'skillswap.signup.account'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY)
      if (!saved) return
      const draft = JSON.parse(saved) as Partial<DraftAccount>
      if (typeof draft.email === 'string') setEmail(draft.email)
      if (typeof draft.password === 'string') setPassword(draft.password)
    } catch {
      sessionStorage.removeItem(DRAFT_KEY)
    }
  }, [])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Enter your email address to continue.')
      return
    }

    const draft: DraftAccount = { email: normalizedEmail, password }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      setError('Your browser is blocking session storage. Please allow site storage and try again.')
      return
    }

    window.location.assign('/onboarding/profile')
  }

  return (
    <main className="premium-auth-page">
      <div className="premium-auth-wrap">
        <a className="premium-top-brand" href="/">
          <span className="premium-brand-mark"><Sparkles size={15} /></span>
          <span>SkillSwap</span>
        </a>

        <section className="premium-single-card signup-card">
          <div className="premium-visual premium-visual-signup">
            <div className="premium-visual-glow" />
            <img
              className="premium-illustration"
              src="/onboarding/1.webp"
              alt=""
              width={520}
              height={390}
              fetchPriority="high"
            />
            <div className="premium-orbit premium-orbit-a" />
            <div className="premium-orbit premium-orbit-b" />
          </div>

          <div className="premium-content">
            <div className="premium-progress-row">
              <div className="premium-progress"><span style={{ width: '33%' }} /></div>
              <span>01 / 03</span>
            </div>

            <div className="premium-copy">
              <p className="premium-eyebrow">START YOUR JOURNEY</p>
              <h1>Create your account.</h1>
              <p className="premium-description">
                A small first step. We'll build your profile together before you meet the SkillSwap community.
              </p>
            </div>

            <form className="premium-form" onSubmit={submit}>
              <label className="premium-field-wrap">
                <span className="premium-field-label">Email address</span>
                <div className="premium-input-shell">
                  <Mail size={16} aria-hidden />
                  <input
                    className="premium-field"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </label>

              <PasswordField value={password} onChange={setPassword} />

              <label className="premium-field-wrap">
                <span className="premium-field-label">Confirm password</span>
                <div className="premium-input-shell">
                  <LockKeyhole size={16} aria-hidden />
                  <input
                    className="premium-field"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    minLength={8}
                    required
                  />
                </div>
              </label>

              {error && <div className="premium-error" role="alert">{error}</div>}

              <button className="premium-primary" type="submit">
                Continue <ArrowRight size={17} />
              </button>
            </form>

            <div className="premium-footer-row">
              <span>Already have an account?</span>
              <Link className="premium-link" href="/auth/login">Sign in</Link>
            </div>
          </div>
        </section>

        <p className="premium-footnote">Your account is created only after you complete onboarding.</p>
      </div>
    </main>
  )
}

export { DRAFT_KEY }
