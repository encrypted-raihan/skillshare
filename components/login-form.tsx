'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, LogIn } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSupabaseConfigError } from '@/lib/supabase/config'
import { PasswordField } from './password-field'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const configError = getSupabaseConfigError()
    if (configError) {
      setError(`Supabase setup error: ${configError}`)
      setBusy(false)
      return
    }

    let supabase
    try {
      supabase = createClient()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not initialize Supabase.')
      setBusy(false)
      return
    }
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setBusy(false)
        return
      }

      const next = searchParams.get('next')
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
      window.location.assign(safeNext)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign in failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="icon-box"><LogIn size={20} /></div>
        <p className="eyebrow" style={{ marginTop: 24 }}>WELCOME BACK</p>
        <h1>Sign in and get learning.</h1>
        <p className="subtext">Your completed profile and skills are waiting for you.</p>

        <form className="form" onSubmit={submit}>
          <label className="field-wrap">
            <span className="field-label">Email address</span>
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <PasswordField
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />

          {error && <div className="notice error" role="alert">{error}</div>}

          <div className="inline-row">
            <Link href="/auth/forgot-password" className="text-link">Forgot password?</Link>
            <button className="button-primary" type="submit" disabled={busy}>
              {busy ? <><Loader2 size={16} className="spin" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </div>
        </form>

        <p className="auth-footer">
          New to SkillSwap? <Link className="text-link" href="/auth/sign-up">Create your account</Link>
        </p>
      </section>
    </main>
  )
}
