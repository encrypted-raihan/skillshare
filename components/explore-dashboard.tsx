'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Palette,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isJwtIssuedAtFutureError, sleep } from '@/lib/supabase/retry'

type Profile = {
  id: string
  full_name: string
  bio: string | null
  avatar_url: string | null
}

type Skill = {
  id: string
  name: string
}

type UserSkill = {
  user_id: string
  skill_id: string
  skill_type: 'OFFER' | 'NEED'
  proficiency: string | null
}

type ProfileCardData = Profile & {
  skills: string[]
}

type RequestRow = {
  sender_id: string
  receiver_id: string
  status: string
}



function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function categoryForSkill(skill: string) {
  const normalized = skill.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return category
  }
  return 'all'
}

function categoryIcon(value: string) {
  if (value === 'tech') return <Sparkles size={16} />
  if (value === 'design') return <Palette size={16} />
  if (value === 'business') return <BookOpen size={16} />
  if (value === 'languages') return <UsersRound size={16} />
  if (value === 'creative') return <Palette size={16} />
  return <LayoutGrid size={16} />
}

export function ExploreDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<ProfileCardData[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [friendCount, setFriendCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeIndex, setActiveIndex] = useState(0)
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [requestBusy, setRequestBusy] = useState<string | null>(null)
  const [requestMessage, setRequestMessage] = useState('')
  const [error, setError] = useState('')
  const wheelLockRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (!mounted) return

      if (userError || !userData.user) {
        window.location.replace('/auth/login')
        return
      }

      const userId = userData.user.id
      setCurrentUserId(userId)

      const loadCommunityData = async () => {
        // A fresh Auth JWT can occasionally reach PostgREST a fraction of a
        // second before PostgREST's clock/cache has caught up. Retry only
        // that specific transient condition; ordinary DB errors fail fast.
        const retryDelays = [0, 350, 800, 1400]

        for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
          if (retryDelays[attempt] > 0) await sleep(retryDelays[attempt])

          const results = await Promise.all([
            supabase.from('profiles').select('id, full_name, bio, avatar_url').eq('id', userId).maybeSingle(),
            supabase.from('profiles').select('id, full_name, bio, avatar_url').neq('id', userId).order('full_name', { ascending: true }),
            supabase.from('skills').select('id, name'),
            supabase.from('user_skills').select('user_id, skill_id, skill_type, proficiency'),
            supabase
              .from('swap_requests')
              .select('sender_id, receiver_id, status')
              .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
          ])

          const errors = results.map((result) => result.error).filter(Boolean)
          const hasJwtTimingError = errors.some(isJwtIssuedAtFutureError)

          if (!hasJwtTimingError || attempt === retryDelays.length - 1) {
            return results
          }
        }

        throw new Error('Unable to load the SkillSwap community.')
      }

      const [profileResult, profilesResult, skillsResult, userSkillsResult, requestsResult] = await loadCommunityData()

      if (!mounted) return

      if (profileResult.error) {
        setError(profileResult.error.message)
        setLoading(false)
        return
      }

      if (profilesResult.error || skillsResult.error || userSkillsResult.error || requestsResult.error) {
        const firstError = profilesResult.error || skillsResult.error || userSkillsResult.error || requestsResult.error
        setError(
          isJwtIssuedAtFutureError(firstError)
            ? 'We could not connect to the community yet. Please try again in a moment.'
            : firstError?.message ?? 'Unable to load the SkillSwap community.',
        )
        setLoading(false)
        return
      }

      const allProfiles = (profilesResult.data ?? []) as Profile[]
      const skills = (skillsResult.data ?? []) as Skill[]
      const allUserSkills = (userSkillsResult.data ?? []) as UserSkill[]
      const requestRows = (requestsResult.data ?? []) as RequestRow[]
      const skillMap = new Map(skills.map((skill) => [skill.id, skill.name]))

      const groupedSkills = new Map<string, string[]>()
      allUserSkills.forEach((userSkill) => {
        if (userSkill.skill_type !== 'OFFER') return
        const skillName = skillMap.get(userSkill.skill_id)
        if (!skillName) return
        const existing = groupedSkills.get(userSkill.user_id) ?? []
        if (!existing.includes(skillName)) existing.push(skillName)
        groupedSkills.set(userSkill.user_id, existing)
      })

      const acceptedFriendIds = new Set(
        requestRows
          .filter((request) => request.status === 'ACCEPTED')
          .map((request) => (request.sender_id === userId ? request.receiver_id : request.sender_id)),
      )

      const discoverableProfiles = allProfiles.filter((profile) => !acceptedFriendIds.has(profile.id))
      const cardData = discoverableProfiles.map((profile) => ({
        ...profile,
        skills: groupedSkills.get(profile.id) ?? [],
      }))

      setCurrentProfile((profileResult.data as Profile | null) ?? null)
      setProfiles(cardData)
      setRequests(requestRows)
      setFriendCount(acceptedFriendIds.size)
      setLoading(false)
    }

    loadDashboard()
    return () => {
      mounted = false
    }
  }, [supabase])

  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return profiles.filter((profile) => {
      const haystack = [profile.full_name, profile.bio ?? '', ...profile.skills].join(' ').toLowerCase()
      const matchesSearch = !query || haystack.includes(query)
      const matchesCategory = activeCategory === 'all' || profile.skills.some((skill) => categoryForSkill(skill) === activeCategory)
      return matchesSearch && matchesCategory
    })
  }, [profiles, searchTerm, activeCategory])

  const trendingSkills = useMemo(() => {
    const counts = new Map<string, number>()
    profiles.forEach((profile) => profile.skills.forEach((skill) => counts.set(skill, (counts.get(skill) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [profiles])

  const sentRequestIds = useMemo(
    () => new Set(requests.filter((request) => request.sender_id === currentUserId).map((request) => request.receiver_id)),
    [requests, currentUserId],
  )

  const pendingIncomingCount = useMemo(
    () => requests.filter((request) => request.receiver_id === currentUserId && request.status === 'PENDING').length,
    [requests, currentUserId],
  )

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filteredProfiles.length - 1, 0)))
  }, [filteredProfiles.length])

  function goPrevious() {
    if (!filteredProfiles.length) return
    setActiveIndex((index) => (index - 1 + filteredProfiles.length) % filteredProfiles.length)
  }

  function goNext() {
    if (!filteredProfiles.length) return
    setActiveIndex((index) => (index + 1) % filteredProfiles.length)
  }

  function passProfile(direction: 'next' | 'previous' = 'next') {
    if (filteredProfiles.length <= 1) return
    setRequestMessage('')
    setError('')
    if (direction === 'previous') goPrevious()
    else goNext()
  }

  function handleCarouselWheel(event: WheelEvent<HTMLDivElement>) {
    if (filteredProfiles.length <= 1 || wheelLockRef.current) return

    // Only horizontal wheel/trackpad gestures navigate the carousel.
    // Vertical scrolling must remain normal page scrolling.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    if (Math.abs(event.deltaX) < 12) return

    event.preventDefault()
    wheelLockRef.current = true

    // Horizontal scroll right = next/pass, horizontal scroll left = previous.
    passProfile(event.deltaX > 0 ? 'next' : 'previous')

    window.setTimeout(() => {
      wheelLockRef.current = false
    }, 420)
  }

  function handleCarouselPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    suppressClickRef.current = false
  }

  function handleCarouselPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || filteredProfiles.length <= 1) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const distance = Math.max(Math.abs(dx), Math.abs(dy))
    if (distance < 55 || Math.abs(dx) < Math.abs(dy)) return

    suppressClickRef.current = true
    passProfile(dx < 0 ? 'next' : 'previous')
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 80)
  }

  async function requestSwap(profileId: string) {
    if (!currentUserId || requestBusy || sentRequestIds.has(profileId)) return
    setRequestBusy(profileId)
    setRequestMessage('')
    setError('')

    const { error: rpcError } = await supabase.rpc('create_swap_request', { target_user_id: profileId })
    if (rpcError) {
      setError(rpcError.message)
      setRequestBusy(null)
      return
    }

    setRequests((existing) => [...existing, { sender_id: currentUserId, receiver_id: profileId, status: 'PENDING' }])
    setRequestMessage('Swap request sent. Nice move.')
    setRequestBusy(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  const displayName = currentProfile?.full_name?.split(' ')[0] || 'there'
  const activeProfile = filteredProfiles[activeIndex]

  return (
    <main className="explore-shell">
      <aside className="explore-sidebar">
        <a href="/explore" className="explore-logo" aria-label="SkillSwap home">
          <span className="explore-logo-mark"><span /><span /><span /><span /></span>
          <span>
            <strong>SkillSwap</strong>
            <small>Learn · Teach · Grow</small>
          </span>
        </a>

        <nav className="explore-nav" aria-label="Main navigation">
          <a className="explore-nav-item active" href="/explore"><Compass size={18} /><span>Explore</span></a>
          <a className="explore-nav-item" href="/requests"><Send size={18} /><span>Requests</span></a>
          <a className="explore-nav-item" href="/messages"><MessageCircle size={18} /><span>Messages</span></a>
          <a className="explore-nav-item" href="/friends"><UsersRound size={18} /><span>Friends</span></a>
        </nav>

        <div className="sidebar-spacer" />
        <nav className="explore-nav explore-nav-secondary" aria-label="Secondary navigation">
          <a className="explore-nav-item" href="/help"><CircleHelp size={18} /><span>Help</span></a>
          <a className="explore-nav-item" href="/settings"><Settings size={18} /><span>Settings</span></a>
        </nav>

        <div className="sidebar-quote">
          <Sparkles size={15} />
          <p>A more skilled world is a kinder world.</p>
          <div className="quote-wave quote-wave-one" />
          <div className="quote-wave quote-wave-two" />
        </div>
      </aside>

      <section className="explore-main">
        <header className="explore-topbar">
          <label className="explore-search">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setActiveIndex(0)
              }}
              placeholder="Search for skills, people or interests..."
              aria-label="Search SkillSwap"
            />
            {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Clear search"><X size={15} /></button>}
            <span className="search-filter-icon"><SlidersHorizontal size={17} /></span>
          </label>

          <div className="topbar-actions">
            <button className="icon-circle" type="button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="account-menu-wrap">
              <button className="account-pill" type="button" onClick={() => setShowMenu((value) => !value)} aria-expanded={showMenu}>
                <span className="avatar avatar-top">
                  {currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" /> : initials(currentProfile?.full_name || displayName)}
                </span>
                <span className="account-copy"><small>Welcome back,</small><strong>{currentProfile?.full_name || 'SkillSwap member'}</strong></span>
                <ChevronDown size={15} />
              </button>
              {showMenu && (
                <div className="account-popover">
                  <div className="account-popover-head">
                    <span className="avatar">{currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" /> : initials(currentProfile?.full_name || displayName)}</span>
                    <div><strong>{currentProfile?.full_name || 'SkillSwap member'}</strong><small>Account</small></div>
                  </div>
                  <a href="/profile"><UserRound size={15} /> Profile</a>
                  <button type="button" onClick={signOut}><LogOut size={15} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="explore-content">
          <section className="explore-hero">
            <img className="hero-art" src="/hero-orb.png" alt="" aria-hidden="true" />
            <div className="hero-overlay" />
            <div className="hero-copy-block">
              <div className="hero-eyebrow-row"><span className="hero-eyebrow-dot" /> PEOPLE · SKILLS · OPPORTUNITIES</div>
              <h1>Explore skills.<br /><em>Meet people.</em></h1>
              <p>Discover what people know. Find a skill you want to learn.<br />Start the conversation when you find the right person.</p>
            </div>
            
          </section>

          <div className="category-row" aria-label="Skill categories">
          </div>

          <section className="community-section">
            <div className="section-heading-row community-heading">
              <div>
                <p className="section-kicker">THE COMMUNITY</p>
                <h2>Find your next skill swap.</h2>
                <p className="section-description">Discover people who can teach something worth learning.</p>
              </div>
              <div className="carousel-controls">
                <button className="circle-next" type="button" onClick={goPrevious} disabled={!filteredProfiles.length} aria-label="Previous person"><ChevronLeft size={17} /></button>
                <span>{filteredProfiles.length ? `${activeIndex + 1} of ${filteredProfiles.length}` : '0 people'}</span>
                <button className="circle-next" type="button" onClick={goNext} disabled={!filteredProfiles.length} aria-label="Next person"><ChevronRight size={17} /></button>
              </div>
            </div>

            {error && <div className="explore-alert error">{error}</div>}
            {requestMessage && <div className="explore-alert success">{requestMessage}</div>}

            {loading ? (
              <div className="community-carousel skeleton-carousel">
                {[0, 1, 2].map((item) => <div className="carousel-skeleton" key={item}><div className="skeleton-photo" /><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}
              </div>
            ) : !activeProfile ? (
              <div className="empty-discovery">
                <Sparkles size={22} />
                <h3>No people found.</h3>
                <p>Try a different person or skill, or switch back to All skills.</p>
              </div>
            ) : (
              <>
                <div
                  className="community-carousel"
                  onWheel={handleCarouselWheel}
                  onPointerDown={handleCarouselPointerDown}
                  onPointerUp={handleCarouselPointerUp}
                  onPointerCancel={() => { pointerStartRef.current = null }}
                  style={{ touchAction: 'pan-y' }}
                  aria-label="Community member carousel. Scroll or swipe to pass."
                >
                  {filteredProfiles.map((profile, index) => {
                    let offset = index - activeIndex
                    const total = filteredProfiles.length
                    if (offset > total / 2) offset -= total
                    if (offset < -total / 2) offset += total
                    // Render a 5-position loop: one dominant center card,
                    // two blurred neighbours, plus two barely-visible outer
                    // cards. The outer cards are intentionally pushed toward
                    // the edges so the carousel feels continuous/infinite
                    // without making five cards visually compete at once.
                    if (Math.abs(offset) > 2) return null

                    const isActive = offset === 0
                    const isSide = Math.abs(offset) === 1
                    const isOuter = Math.abs(offset) === 2
                    const hasRequest = sentRequestIds.has(profile.id)

                    return (
                      <article
                        key={profile.id}
                        className={`community-card ${isActive ? 'is-active' : ''} ${isSide ? 'is-side' : ''} ${isOuter ? 'is-outer' : ''} offset-${offset}`}
                        role="link"
                        tabIndex={0}
                        onClick={() => {
                          if (suppressClickRef.current) return
                          window.location.assign(`/people/${profile.id}`)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            window.location.assign(`/people/${profile.id}`)
                          }
                        }}
                        aria-label={`View ${profile.full_name}'s profile`}
                      >
                        <div className="community-card-image">
                          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initials(profile.full_name)}</span>}
                        </div>
                        <div className="community-card-body">
                          <h3 className="community-name">{profile.full_name}</h3>
                          <p className="community-bio">{profile.bio || 'SkillSwap community member'}</p>
                          <p className="skill-label">SKILLS THEY CAN SHARE</p>
                          <div className="tag-row">
                            {profile.skills.length ? profile.skills.slice(0, 5).map((skill) => <span className="skill-tag dark" key={skill}>{skill}</span>) : <span className="empty-inline">No skills listed yet.</span>}
                          </div>
                          <div className="community-card-footer">
                            <span><strong>{profile.skills.length}</strong> {profile.skills.length === 1 ? 'skill' : 'skills'} shared</span>
                            {isActive && (
                              <div className="community-card-actions">
                                <button
                                  className="pass-button"
                                  type="button"
                                  disabled={filteredProfiles.length <= 1 || requestBusy !== null}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    passProfile()
                                  }}
                                  aria-label={`Pass on ${profile.full_name}`}
                                  title="Pass"
                                >
                                  Pass
                                </button>

                                <button
                                  className={`request-button ${hasRequest ? 'requested' : ''}`}
                                  type="button"
                                  disabled={hasRequest || requestBusy === profile.id}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    requestSwap(profile.id)
                                  }}
                                >
                                  {requestBusy === profile.id ? 'Sending…' : hasRequest ? 'Requested' : <>Request a swap <Send size={14} /></>}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>

                <div className="carousel-footer">
                  <div className="carousel-dots" aria-label="People carousel">
                    {filteredProfiles.map((profile, index) => (
                      <button key={profile.id} type="button" className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)} aria-label={`Show ${profile.full_name}`} />
                    ))}
                  </div>
                  <span>REAL PEOPLE. REAL SKILLS. BRIGHTER OPPORTUNITIES.</span>
                </div>
              </>
            )}
          </section>

          <section className="trending-section">
            <div className="section-heading-row compact">
              <div><p className="section-kicker">COMMUNITY</p><h2>Trending skills</h2></div>
              <span className="result-count">{profiles.length} {profiles.length === 1 ? 'person' : 'people'} exploring</span>
            </div>
            <div className="trending-list">
              {trendingSkills.length === 0 ? (
                <div className="trending-empty">Your community is still taking shape. Add more skills to make this space lively.</div>
              ) : trendingSkills.map(([skill, count], index) => (
                <button key={skill} type="button" className={`trend-pill trend-tone-${index % 4}`} onClick={() => { setSearchTerm(skill); setActiveIndex(0) }}>
                  <span className="trend-icon">{index === 0 ? <Sparkles size={17} /> : index === 1 ? <Palette size={17} /> : index === 2 ? <Compass size={17} /> : <BookOpen size={17} />}</span>
                  <span><strong>{skill}</strong><small>{count} {count === 1 ? 'person' : 'people'}</small></span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
