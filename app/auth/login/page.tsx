'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (signInError) throw signInError
      window.location.assign('/explore')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.')
      setBusy(false)
    }
  }

  return (
    <main className="reference-auth-page">
      <section className="reference-auth-shell">
        <div className="reference-auth-form">
          <a className="reference-auth-brand" href="/" aria-label="Back to SkillSwap">
            <img src="/onboarding/logo.webp" alt="" />
            <span>SkillSwap</span>
          </a>

          <h1>Welcome back.</h1>
          <p>Sign in to discover people whose skills complement what you want to learn.</p>

          <form className="form" onSubmit={handleSubmit}>
            <label className="field-group">
              <span className="field-label">Email address</span>
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>

            <label className="field-group">
              <span className="field-label">Password</span>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required style={{ paddingRight: 52 }} />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} style={{ position: 'absolute', right: 7, top: 7, width: 36, height: 36, border: 0, background: 'transparent', color: 'var(--muted)' }}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && <div className="notice error" role="alert">{error}</div>}

            <button className="reference-auth-submit" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : <>Login <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="reference-auth-register">
            New to SkillSwap? <a className="text-link" href="/auth/sign-up">Create your account</a>
          </div>
        </div>

        <div className="reference-auth-panel">
          <img src="/onboarding/5.webp" alt="SkillSwap community illustration" />
          <div className="reference-auth-caption">
            <h2>Learn together. Grow together.</h2>
            <p>Find useful people, share what you know, and turn a simple skill into a real connection.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
