 'use client'

import { ArrowRight, Loader2, LockKeyhole } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function UpdatePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use a password with at least 8 characters.')
    if (password !== confirm) return setError('The passwords do not match.')

    setBusy(true)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) setError(updateError.message)
    else setDone(true)
    setBusy(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="icon-box"><LockKeyhole size={20} /></div>
        <p className="eyebrow" style={{ marginTop: 24 }}>NEW PASSWORD</p>
        <h1>Choose a new password.</h1>
        {done ? (
          <div className="form">
            <div className="notice info">Your password has been updated successfully.</div>
            <button className="button-primary" onClick={() => router.replace('/auth/login')}>
              Continue to sign in <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <label className="field-wrap">
              <span className="field-label">New password</span>
              <input className="field" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label className="field-wrap">
              <span className="field-label">Confirm password</span>
              <input className="field" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            {error && <div className="notice error" role="alert">{error}</div>}
            <button className="button-primary" disabled={busy}>
              {busy ? <><Loader2 size={16} /> Saving…</> : <>Update password <ArrowRight size={16} /></>}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
