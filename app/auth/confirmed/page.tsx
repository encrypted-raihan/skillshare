'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearAllOnboardingStorage, readPendingAvatar } from '@/lib/onboarding'

async function finishPendingAvatar() {
  const dataUrl = readPendingAvatar()
  if (!dataUrl) return
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return

  const comma = dataUrl.indexOf(',')
  if (comma === -1) return
  const mime = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg'
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const blob = new Blob([bytes], { type: mime })
  const path = `${data.user.id}/avatar`
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { cacheControl: '3600', upsert: true, contentType: mime })
  if (uploadError) return
  const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`
  const { error: profileError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', data.user.id)
  if (!profileError) clearAllOnboardingStorage()
}

export default function ConfirmedPage() {
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    finishPendingAvatar().finally(() => setBusy(false))
  }, [])

  return (
    <main className="auth-page">
      <section className="auth-card success">
        <div className="success-mark"><CheckCircle2 size={30}/></div>
        <p className="eyebrow">YOU'RE IN THE FLOW</p>
        <h2 style={{margin:'0 0 10px'}}>Check your email.</h2>
        <p style={{color:'var(--muted)',lineHeight:1.7}}>Your SkillSwap account has been created after completing onboarding. Confirm your email to finish signing in.</p>
        {busy && readPendingAvatar() ? <p style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,marginTop:14,color:'var(--muted)',fontSize:12}}><LoaderCircle className="spin" size={15}/> Preparing your profile photo…</p> : null}
        <div className="stack" style={{marginTop:24}}><a className="btn btn-primary" href="/auth/login">Go to sign in</a><a className="btn btn-secondary" href="/">Back to SkillSwap</a></div>
      </section>
    </main>
  )
}
