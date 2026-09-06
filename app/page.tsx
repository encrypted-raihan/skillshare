'use client'
import { ArrowRight, Check, ChevronRight, CircleCheck, Lightbulb, MessageCircle, Sparkles, UsersRound } from 'lucide-react'

const highlights = [
  'Learn directly from real people',
  'Share practical skills you already know',
  'Build useful connections, not follower counts',
]

const steps = [
  {
    number: '01',
    title: 'Build your profile',
    body: 'Tell the community what you know, what you enjoy, and what you are curious about learning next.',
    points: ['Add the skills you can teach', 'Tell people a little about you', 'Choose what you want to learn'],
  },
  {
    number: '02',
    title: 'Find the right person',
    body: 'Explore people whose skills complement your goals instead of scrolling through a generic social feed.',
    points: ['Search skills and people', 'Browse real community profiles', 'Look for complementary interests'],
  },
  {
    number: '03',
    title: 'Start the swap',
    body: 'Send a request, start a conversation, and turn a shared interest into a useful exchange.',
    points: ['Send a focused swap request', 'Chat when there is a mutual fit', 'Learn by actually doing'],
  },
]

const examples = [
  { you: 'Web development', them: 'UI / UX design', note: 'Build the product together.' },
  { you: 'Photography', them: 'Video editing', note: 'Turn raw ideas into finished stories.' },
  { you: 'Python', them: 'Public speaking', note: 'Trade technical and communication skills.' },
]

const principles = [
  {
    icon: UsersRound,
    title: 'People first',
    text: 'The goal is not to collect followers. It is to find people you can actually learn from.',
  },
  {
    icon: Lightbulb,
    title: 'Useful skills',
    text: 'Focus on practical knowledge people can share, practise, and improve together.',
  },
  {
    icon: MessageCircle,
    title: 'Real conversations',
    text: 'A profile is only the beginning. The real value starts when two people connect.',
  },
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
          <a href="#creator">Creator</a>
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

      <section className="landing-story" id="why-skillswap">
        <div className="landing-story-intro">
          <p className="landing-section-kicker">WHY SKILLSWAP</p>
          <h2>Less scrolling.<br />More actual learning.</h2>
          <p>
            Most social platforms are built around attention. SkillSwap is built around usefulness: find someone who knows what you want to learn, share what you know, and start a conversation worth having.
          </p>
          <a className="landing-text-link" href="/auth/sign-up">Join the community <ArrowRight size={15} /></a>
        </div>

        <div className="landing-principle-grid">
          {principles.map(({ icon: Icon, title, text }) => (
            <article key={title} className="landing-principle-card">
              <div className="landing-principle-icon"><Icon size={18} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-exchange">
        <div className="landing-exchange-heading">
          <div>
            <p className="landing-section-kicker">PICTURE THE EXCHANGE</p>
            <h2>Everyone knows something.<br /><em>Everyone can learn something.</em></h2>
          </div>
          <p>SkillSwap works because you do not need to be an expert. You just need something useful to share.</p>
        </div>

        <div className="landing-exchange-grid">
          {examples.map((example) => (
            <article key={example.you} className="landing-exchange-card">
              <div className="landing-exchange-side">
                <span>You know</span>
                <strong>{example.you}</strong>
              </div>
              <div className="landing-exchange-arrow"><ArrowRight size={17} /></div>
              <div className="landing-exchange-side landing-exchange-side-right">
                <span>You find</span>
                <strong>{example.them}</strong>
              </div>
              <p>{example.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-how-expanded" id="how-it-works">
        <div className="landing-how-expanded-heading">
          <div>
            <p className="landing-section-kicker">HOW IT WORKS</p>
            <h2>Simple by design.<br /><em>Clear by experience.</em></h2>
          </div>
          <p>
            From your first profile to your first real conversation, every part of SkillSwap is designed to reduce friction and make the next useful connection obvious.
          </p>
        </div>

        <div className="landing-step-expanded-grid">
          {steps.map((step) => (
            <article key={step.number} className="landing-step-expanded-card">
              <div className="landing-step-expanded-number">{step.number}</div>
              <div className="landing-step-expanded-content">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <ul>
                  {step.points.map((point) => (
                    <li key={point}><CircleCheck size={15} />{point}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-connection">
        <div className="landing-connection-art">
          <div className="landing-connection-window">
            <div className="landing-window-top"><span /><span /><span /></div>
            <div className="landing-connection-stack">
              <div className="landing-mini-profile primary"><b>UI</b><span>Looking for web development</span></div>
              <div className="landing-mini-profile secondary"><b>WD</b><span>Can share app development</span></div>
              <div className="landing-mini-profile tertiary"><b>VC</b><span>Interested in learning together</span></div>
            </div>
          </div>
        </div>
        <div className="landing-connection-copy">
          <p className="landing-section-kicker">THE REAL PRODUCT</p>
          <h2>More than a skill exchange.</h2>
          <p>
            A skill is the starting point. The bigger idea is connection. SkillSwap helps students and curious people meet outside the usual circles — through something they already know or want to learn.
          </p>
          <div className="landing-connection-points">
            <div><strong>01</strong><span>Find someone outside your usual network.</span></div>
            <div><strong>02</strong><span>Have a reason to start the conversation.</span></div>
            <div><strong>03</strong><span>Turn shared curiosity into a real connection.</span></div>
          </div>
        </div>
      </section>

      <section className="landing-cta-block">
        <p className="landing-section-kicker">READY WHEN YOU ARE</p>
        <h2>Find someone worth<br /><em>learning from.</em></h2>
        <p>Build your profile, discover the community, and see where one useful conversation takes you.</p>
        <div className="landing-actions">
          <a className="landing-primary" href="/auth/sign-up">Create your account <ArrowRight size={18} /></a>
          <a className="landing-secondary" href="/auth/login">Sign in</a>
        </div>
      </section>

      <section className="landing-creator" id="creator">
        <div className="landing-creator-mark">RS</div>
        <div className="landing-creator-copy">
          <p className="landing-section-kicker">BUILT BY</p>
          <h2>Raihan Shiras</h2>
          <p>
            SkillSwap is designed and built by Raihan Shiras — a student, developer, and builder interested in creating products that make technology feel more human.
          </p>
          <a className="landing-text-link" href="https://raihanshiras.vercel.app/" target="_blank" rel="noreferrer">
            View Raihan's portfolio <ChevronRight size={16} />
          </a>
        </div>
      </section>

      <footer className="landing-footer landing-footer-expanded">
        <div>
          <span className="landing-footer-brand">SkillSwap</span>
          <small>Learn · Teach · Grow</small>
        </div>
        <div className="landing-footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="#why-skillswap">Why SkillSwap</a>
          <a href="https://raihanshiras.vercel.app/" target="_blank" rel="noreferrer">Raihan's portfolio</a>
        </div>
        <span>© 2026 SkillSwap</span>
      </footer>

      <style jsx global>{`
        .landing-page { overflow: clip; }
        .landing-story,
        .landing-exchange,
        .landing-how-expanded,
        .landing-connection,
        .landing-cta-block,
        .landing-creator { width: min(1240px, calc(100% - 56px)); margin-inline: auto; }

        .landing-story { padding: 110px 0 118px; border-top: 1px solid rgba(31,65,50,.08); }
        .landing-story-intro { max-width: 850px; }
        .landing-story-intro h2,
        .landing-exchange-heading h2,
        .landing-how-expanded-heading h2,
        .landing-connection-copy h2,
        .landing-cta-block h2,
        .landing-creator-copy h2 { margin: 12px 0 0; font-size: clamp(46px, 5.6vw, 78px); line-height: .94; letter-spacing: -.065em; }
        .landing-story-intro h2 { max-width: 700px; }
        .landing-story-intro > p:not(.landing-section-kicker) { max-width: 720px; margin: 25px 0 0; color: #6e7d75; font-size: 17px; line-height: 1.85; }
        .landing-text-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 24px; color: #216648; font-size: 12px; font-weight: 850; }
        .landing-text-link:hover { gap: 10px; }
        .landing-principle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 60px; }
        .landing-principle-card { min-height: 250px; padding: 28px; border: 1px solid rgba(31,65,50,.08); border-radius: 24px; background: rgba(255,255,255,.58); box-shadow: 0 16px 35px rgba(40,63,52,.04); }
        .landing-principle-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: #deefe6; color: #216648; }
        .landing-principle-card h3 { margin: 58px 0 9px; font-size: 21px; letter-spacing: -.035em; }
        .landing-principle-card p { margin: 0; color: #738078; font-size: 12px; line-height: 1.75; }

        .landing-exchange { padding: 105px 0 120px; border-top: 1px solid rgba(31,65,50,.08); }
        .landing-exchange-heading, .landing-how-expanded-heading { display: grid; grid-template-columns: 1fr .65fr; gap: 70px; align-items: end; }
        .landing-exchange-heading h2 em, .landing-how-expanded-heading h2 em, .landing-cta-block h2 em { color: #287452; font-style: normal; }
        .landing-exchange-heading > p, .landing-how-expanded-heading > p { margin: 0; color: #718078; font-size: 14px; line-height: 1.8; max-width: 460px; justify-self: end; }
        .landing-exchange-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 54px; }
        .landing-exchange-card { position: relative; min-height: 240px; padding: 25px; display: grid; grid-template-columns: 1fr auto 1fr; align-content: start; gap: 12px; border: 1px solid rgba(31,65,50,.08); border-radius: 24px; background: linear-gradient(145deg, rgba(255,255,255,.82), rgba(236,245,239,.7)); }
        .landing-exchange-side { display: grid; gap: 7px; }
        .landing-exchange-side span { color: #93a099; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .13em; }
        .landing-exchange-side strong { font-size: 16px; line-height: 1.15; letter-spacing: -.03em; }
        .landing-exchange-side-right { text-align: right; }
        .landing-exchange-arrow { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: rgba(221,239,228,.8); color: #246846; }
        .landing-exchange-card > p { grid-column: 1 / -1; align-self: end; margin: 48px 0 0; padding-top: 17px; border-top: 1px solid rgba(31,65,50,.08); color: #738078; font-size: 11px; line-height: 1.6; }

        .landing-how-expanded { padding: 105px 0 120px; border-top: 1px solid rgba(31,65,50,.08); }
        .landing-step-expanded-grid { margin-top: 52px; display: grid; gap: 12px; }
        .landing-step-expanded-card { display: grid; grid-template-columns: 110px 1fr; gap: 28px; padding: 30px 28px; border: 1px solid rgba(31,65,50,.08); border-radius: 24px; background: rgba(255,255,255,.64); }
        .landing-step-expanded-number { color: #a1b0a8; font-size: 12px; font-weight: 900; letter-spacing: .17em; }
        .landing-step-expanded-content { display: grid; grid-template-columns: .8fr 1.2fr; gap: 38px; align-items: start; }
        .landing-step-expanded-content h3 { margin: 0; font-size: 26px; letter-spacing: -.045em; }
        .landing-step-expanded-content > p { margin: 0; max-width: 480px; color: #718078; font-size: 13px; line-height: 1.75; }
        .landing-step-expanded-content ul { grid-column: 2; display: grid; gap: 10px; margin: 5px 0 0; padding: 0; list-style: none; }
        .landing-step-expanded-content li { display: flex; align-items: center; gap: 9px; color: #51645a; font-size: 11px; }
        .landing-step-expanded-content li svg { color: #3a8a62; }

        .landing-connection { padding: 34px 0 120px; display: grid; grid-template-columns: .95fr 1.05fr; gap: 85px; align-items: center; }
        .landing-connection-art { min-height: 470px; display: grid; place-items: center; }
        .landing-connection-window { width: min(470px, 100%); padding: 10px; border-radius: 28px; background: rgba(255,255,255,.72); border: 1px solid rgba(31,65,50,.08); box-shadow: 0 30px 70px rgba(40,63,52,.1); transform: rotate(-2deg); }
        .landing-window-top { display: flex; gap: 6px; padding: 8px 10px 14px; }
        .landing-window-top span { width: 7px; height: 7px; border-radius: 50%; background: rgba(31,65,50,.16); }
        .landing-connection-stack { padding: 22px 18px 26px; display: grid; gap: 12px; background: linear-gradient(145deg, #edf6f0, #f9fbfa); border-radius: 20px; }
        .landing-mini-profile { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 17px; background: rgba(255,255,255,.85); border: 1px solid rgba(31,65,50,.07); box-shadow: 0 10px 20px rgba(40,63,52,.06); }
        .landing-mini-profile b { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 50%; background: #dceee4; color: #286d4d; font-size: 11px; }
        .landing-mini-profile span { color: #5f7168; font-size: 11px; }
        .landing-mini-profile.secondary { transform: translateX(24px); }
        .landing-mini-profile.tertiary { transform: translateX(50px); }
        .landing-connection-copy > p:not(.landing-section-kicker) { max-width: 600px; margin: 25px 0 0; color: #6e7d75; font-size: 16px; line-height: 1.85; }
        .landing-connection-points { display: grid; gap: 0; margin-top: 36px; border-top: 1px solid rgba(31,65,50,.08); }
        .landing-connection-points div { display: grid; grid-template-columns: 44px 1fr; gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(31,65,50,.08); }
        .landing-connection-points strong { color: #a0afa8; font-size: 10px; letter-spacing: .12em; }
        .landing-connection-points span { color: #52665b; font-size: 12px; }

        .landing-cta-block { padding: 120px 0 126px; text-align: center; border-top: 1px solid rgba(31,65,50,.08); }
        .landing-cta-block h2 { max-width: 850px; margin-inline: auto; }
        .landing-cta-block > p:not(.landing-section-kicker) { max-width: 580px; margin: 22px auto 0; color: #718078; font-size: 15px; line-height: 1.8; }
        .landing-cta-block .landing-actions { justify-content: center; }

        .landing-creator { margin-top: 5px; margin-bottom: 110px; padding: 44px; display: grid; grid-template-columns: auto 1fr; gap: 28px; align-items: center; border: 1px solid rgba(31,65,50,.09); border-radius: 28px; background: linear-gradient(145deg, rgba(255,255,255,.84), rgba(226,241,232,.7)); box-shadow: 0 22px 50px rgba(40,63,52,.06); }
        .landing-creator-mark { width: 74px; height: 74px; display: grid; place-items: center; border-radius: 22px; background: #183f30; color: #fff; font-size: 17px; font-weight: 900; letter-spacing: -.03em; box-shadow: 0 16px 30px rgba(24,63,48,.17); }
        .landing-creator-copy h2 { font-size: clamp(32px, 4vw, 50px); }
        .landing-creator-copy > p:not(.landing-section-kicker) { max-width: 720px; margin: 15px 0 0; color: #6f7e76; font-size: 13px; line-height: 1.8; }

        .landing-footer-expanded { align-items: end; padding-bottom: 38px; }
        .landing-footer-expanded > div:first-child { display: grid; gap: 4px; }
        .landing-footer-brand { color: #25493a; font-weight: 900; }
        .landing-footer-expanded small { color: #8a978f; font-size: 9px; }
        .landing-footer-links { display: flex; gap: 20px; }
        .landing-footer-links a:hover { color: #244f3d; }

        @media (max-width: 900px) {
          .landing-nav-links { display: none; }
          .landing-hero { grid-template-columns: 1fr; min-height: auto; padding-bottom: 50px; }
          .landing-visual { min-height: 460px; }
          .landing-principle-grid, .landing-exchange-grid { grid-template-columns: 1fr; }
          .landing-exchange-heading, .landing-how-expanded-heading, .landing-connection { grid-template-columns: 1fr; gap: 30px; }
          .landing-exchange-heading > p, .landing-how-expanded-heading > p { justify-self: start; }
          .landing-step-expanded-content { grid-template-columns: 1fr; gap: 18px; }
          .landing-step-expanded-content ul { grid-column: auto; }
          .landing-connection { padding-top: 0; }
          .landing-connection-art { min-height: 390px; }
          .landing-mini-profile.secondary { transform: translateX(10px); }
          .landing-mini-profile.tertiary { transform: translateX(20px); }
          .landing-footer-expanded { flex-wrap: wrap; gap: 18px; }
          .landing-footer-links { order: 3; width: 100%; }
        }
        @media (max-width: 600px) {
          .landing-nav, .landing-story, .landing-exchange, .landing-how-expanded, .landing-connection, .landing-cta-block, .landing-creator, .landing-footer { width: min(100% - 28px, 1240px); }
          .landing-nav { min-height: 70px; }
          .landing-hero h1 { font-size: clamp(53px, 16vw, 76px); }
          .landing-lede { font-size: 15px; }
          .landing-highlights { grid-template-columns: 1fr; }
          .landing-image-main { width: 66%; right: 1%; }
          .landing-image-secondary { width: 44%; }
          .landing-story, .landing-exchange, .landing-how-expanded { padding: 82px 0 88px; }
          .landing-step-expanded-card { grid-template-columns: 1fr; }
          .landing-step-expanded-number { margin-bottom: -6px; }
          .landing-creator { grid-template-columns: 1fr; padding: 28px; margin-bottom: 70px; }
          .landing-creator-mark { width: 58px; height: 58px; border-radius: 18px; }
          .landing-footer-links { flex-wrap: wrap; }
        }
      `}</style>
    </main>
  )
}
