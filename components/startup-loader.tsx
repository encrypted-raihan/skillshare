'use client'

import { useEffect, useState } from 'react'

export function StartupLoader() {
  const [visible, setVisible] = useState(true)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const start = window.setTimeout(() => setLeaving(true), 1450)
    const done = window.setTimeout(() => setVisible(false), 1800)

    return () => {
      window.clearTimeout(start)
      window.clearTimeout(done)
    }
  }, [])

  if (!visible) return null

  return (
    <div className={`startup-loader ${leaving ? 'startup-loader-leaving' : ''}`} aria-live="polite" aria-label="Loading SkillSwap">
      <div className="startup-loader-orb orb-a" />
      <div className="startup-loader-orb orb-b" />
      <div className="startup-loader-dots">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="startup-loader-center">
        <div className="startup-loader-art" aria-hidden="true">
          <img
            src="/skillswap-loader-art.webp"
            alt=""
            width={560}
            height={520}
            fetchPriority="high"
          />
        </div>

        <div className="startup-loader-brand"><span>Skill</span><b>Swap</b></div>
        <p className="startup-loader-tagline">PEOPLE TEACH PEOPLE</p>

        <div className="startup-loader-progress" aria-hidden="true">
          <span />
        </div>
        <div className="startup-loader-label">LOADING<span className="startup-loader-ellipsis">...</span></div>
      </div>
    </div>
  )
}
