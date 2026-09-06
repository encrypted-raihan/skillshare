import { CheckCircle2, Sparkles } from 'lucide-react'

export default function ConfirmedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card success">
        <div className="success-mark"><CheckCircle2 size={30}/></div>
        <p className="eyebrow">YOU'RE IN THE FLOW</p>
        <h2 style={{margin:'0 0 10px'}}>Check your email.</h2>
        <p style={{color:'var(--muted)',lineHeight:1.7}}>Your SkillSwap account has been created after completing onboarding. Confirm your email to finish signing in.</p>
        <div className="stack" style={{marginTop:24}}><a className="btn btn-primary" href="/auth/login">Go to sign in</a><a className="btn btn-secondary" href="/">Back to SkillSwap</a></div>
      </section>
    </main>
  )
}
