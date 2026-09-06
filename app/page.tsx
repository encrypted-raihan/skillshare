import { ArrowRight, Check, Sparkles, UsersRound } from 'lucide-react'

const highlights = [
  'Learn directly from real people',
  'Share practical skills you already know',
  'Build useful connections, not follower counts',
]

export default function HomePage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary navigation">
        <a className="landing-logo" href="/" aria-label="SkillSwap home">
          <img src="/onboarding/logo.webp" alt="SkillSwap" />
          <span>SkillSwap</span>
        </a>

        <div className="landing-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#why-skillswap">Why SkillSwap</a>
        </div>

        <div className="landing-nav-actions">
          <a className="landing-signin" href="/auth/login">Sign in</a>
          <a className="landing-nav-cta" href="/auth/sign-up">Get started <ArrowRight size={15} /></a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span /> LEARN · TEACH · GROW</div>
          <h1>Learn something.<br /><em>Teach something.</em></h1>
          <p className="landing-lede">
            SkillSwap makes it easy to trade practical skills with people who have something useful to teach you too.
          </p>

          <div className="landing-actions">
            <a className="landing-primary" href="/auth/sign-up">Create your account <ArrowRight size={18} /></a>
            <a className="landing-secondary" href="/auth/login">Sign in</a>
          </div>

          <div className="landing-trust">
            <UsersRound size={17} />
            <span>Start with a profile. Meet the community once you're ready.</span>
          </div>

          <div className="landing-highlights">
            {highlights.map((item) => (
              <div key={item}><span className="landing-check"><Check size={12} /></span>{item}</div>
            ))}
          </div>
        </div>

        <div className="landing-visual" aria-label="SkillSwap community preview">
          <div className="landing-visual-orb landing-orb-one" />
          <div className="landing-visual-orb landing-orb-two" />
          <div className="landing-image-main">
            <img src="/onboarding/4.webp" alt="SkillSwap learning illustration" />
          </div>
          <div className="landing-image-secondary">
            <img src="/onboarding/5.webp" alt="SkillSwap community illustration" />
          </div>
          <div className="landing-float-card landing-float-top">
            <span className="landing-float-icon"><Sparkles size={14} /></span>
            <div><strong>Swap a skill</strong><small>Find someone who can teach you.</small></div>
          </div>
          <div className="landing-float-card landing-float-bottom">
            <span className="landing-avatar-dot">S</span>
            <div><strong>Real people, real skills.</strong><small>Learn by doing together.</small></div>
          </div>
        </div>
      </section>

      <section className="landing-proof" id="why-skillswap">
        <div>
          <p className="landing-section-kicker">A BETTER KIND OF NETWORK</p>
          <h2>Less scrolling.<br />More learning.</h2>
        </div>
        <p>
          No endless feeds to optimize. No pressure to collect followers. Just people, practical skills, and a reason to start a conversation.
        </p>
      </section>

      <section className="landing-how" id="how-it-works">
        <div className="landing-how-heading">
          <p className="landing-section-kicker">HOW IT WORKS</p>
          <h2>Simple by design.</h2>
        </div>
        <div className="landing-step-grid">
          <article><span>01</span><h3>Build your profile</h3><p>Tell the community what you know and what you want to learn.</p></article>
          <article><span>02</span><h3>Find the right person</h3><p>Explore people whose skills line up with your goals.</p></article>
          <article><span>03</span><h3>Start the swap</h3><p>Send a request and turn a shared interest into a real exchange.</p></article>
        </div>
      </section>

      <footer className="landing-footer">
        <span>SkillSwap</span>
        <span>Learn · Teach · Grow</span>
      </footer>
    </main>
  )
}
