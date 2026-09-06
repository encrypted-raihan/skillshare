'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { readDraft, writeDraft, writeTemporaryPassword } from '@/lib/onboarding'

export default function SignUpPage() {
  const existingDraft = readDraft()
  const [email, setEmail] = useState(existingDraft.accountEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Your password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Your passwords do not match.')

    writeDraft({ ...readDraft(), accountEmail: normalizedEmail })
    writeTemporaryPassword(password)
    window.location.assign('/onboarding/profile')
  }

  return (
    <main className="reference-auth-page">
      <section className="reference-auth-shell reference-signup-shell">
        <div className="reference-auth-form reference-signup-form">
          <a className="reference-auth-brand" href="/" aria-label="Back to SkillSwap">
            <img src="/onboarding/logo.webp" alt="" />
            <span>SkillSwap</span>
          </a>

          <div className="reference-step-kicker">
            <span>01</span>
            <i />
            <span>03</span>
            <em>CREATE YOUR ACCOUNT</em>
          </div>

          <h1>Start learning by sharing.</h1>
          <p className="reference-signup-intro">
            Create your account, then we’ll build your SkillSwap profile together. Nothing public until you are ready.
          </p>

          <form className="form" onSubmit={handleSubmit}>
            <label className="field-group">
              <span className="field-label">Email address</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-label">Password</span>
              <div className="reference-password-wrap">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="reference-eye-button"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <label className="field-group">
              <span className="field-label">Confirm password</span>
              <div className="reference-password-wrap">
                <input
                  className="input"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((value) => !value)}
                  className="reference-eye-button"
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && <div className="notice error" role="alert">{error}</div>}

            <button className="reference-auth-submit reference-signup-submit" type="submit">
              Continue to your profile <ArrowRight size={16} />
            </button>
          </form>

          <div className="reference-auth-register">
            Already have an account? <a className="text-link" href="/auth/login">Sign in</a>
          </div>
        </div>

        <div className="reference-auth-panel reference-signup-panel">
          <div className="reference-panel-badge">
            <span>01 / 03</span>
            <strong>BUILD YOUR PROFILE</strong>
          </div>
          <img src="/onboarding/4.webp" alt="SkillSwap onboarding illustration" />
          <div className="reference-auth-caption">
            <h2>Learn something. Teach something.</h2>
            <p>Start with a few details. We’ll turn them into a profile people can actually connect with.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
