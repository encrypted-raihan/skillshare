'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const origin = window.location.origin

    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    })

    if (resetError) setError(resetError.message)
    else setSent(true)
    setBusy(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="icon-box"><MailCheck size={20} /></div>
        <p className="eyebrow" style={{ marginTop: 24 }}>RESET ACCESS</p>
        <h1>Forgot your password?</h1>
        <p className="subtext">Enter your email and we’ll send you a secure reset link.</p>

        {sent ? (
          <div className="form">
            <div className="notice info">
              Check your inbox for the reset link. The link will return you to SkillSwap so you can choose a new password.
            </div>
            <Link href="/auth/login" className="button-primary">Back to sign in <ArrowRight size={16} /></Link>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <label className="field-wrap">
              <span className="field-label">Email address</span>
              <input
                className="field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            {error && <div className="notice error" role="alert">{error}</div>}
            <div className="inline-row">
              <Link href="/auth/login" className="button-secondary"><ArrowLeft size={16} /> Back</Link>
              <button className="button-primary" type="submit" disabled={busy}>
                {busy ? <><Loader2 size={16} /> Sending…</> : <>Send link <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
