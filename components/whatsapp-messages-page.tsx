'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, FileText, Image as ImageIcon, LoaderCircle, Mic, Paperclip, Search, Send, UserRound } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = { id: string; full_name: string; bio: string | null; avatar_url: string | null }
type Conversation = { id: string; user_a: string; user_b: string; created_at: string; updated_at: string; other?: Person }
type AcceptedRequest = { id: string; sender_id: string; receiver_id: string; created_at: string }
type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  message_type: 'text' | 'image' | 'document' | 'audio'
  media_path: string | null
  media_name: string | null
  media_size: number | null
  mime_type: string | null
  duration_ms: number | null
  delivered_at: string | null
  read_at: string | null
  deleted_at: string | null
  created_at: string
  media_url?: string
}

const SELECT = 'id,conversation_id,sender_id,body,message_type,media_path,media_name,media_size,mime_type,duration_ms,delivered_at,read_at,deleted_at,created_at'
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || 'S'
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const bytes = (value: number | null) => !value ? '' : value < 1024 ? `${value} B` : value < 1048576 ? `${Math.round(value / 1024)} KB` : `${(value / 1048576).toFixed(1)} MB`

export function WhatsAppMessagesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [convos, setConvos] = useState<Conversation[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mobileList, setMobileList] = useState(true)
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = convos.find(c => c.id === selected)
  const other = active?.other

  async function getMediaUrl(path: string | null) {
    if (!path) return ''
    const { data } = await supabase.storage.from('message-media').createSignedUrl(path, 3600)
    return data?.signedUrl || ''
  }

  async function hydrate(rows: Message[]) {
    return Promise.all(rows.map(async row => ({ ...row, media_url: await getMediaUrl(row.media_path) })))
  }

  async function loadFriendsAndConversations() {
    setLoading(true)
    setError('')

    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) {
      window.location.replace('/auth/login?next=/messages')
      return
    }

    const id = auth.user.id
    setUserId(id)

    // Friends are defined by ACCEPTED swap requests. Conversations are only
    // the chat records for those friendships, so the friend list must not
    // depend on conversations already existing.
    const [{ data: requests, error: requestError }, { data: conversationRows, error: conversationError }] = await Promise.all([
      supabase.from('swap_requests')
        .select('id,sender_id,receiver_id,created_at')
        .eq('status', 'ACCEPTED')
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .order('created_at', { ascending: false }),
      supabase.from('conversations')
        .select('id,user_a,user_b,created_at,updated_at')
        .or(`user_a.eq.${id},user_b.eq.${id}`)
        .order('updated_at', { ascending: false }),
    ])

    if (requestError) {
      setError(requestError.message)
      setLoading(false)
      return
    }

    // A previous version only loaded conversations. Self-heal any accepted
    // friendship that does not have a conversation row yet.
    const existingPairs = new Set<string>()
    ;((conversationRows || []) as Conversation[]).forEach(c => {
      const a = c.user_a < c.user_b ? c.user_a : c.user_b
      const b = c.user_a < c.user_b ? c.user_b : c.user_a
      existingPairs.add(`${a}:${b}`)
    })

    const accepted = (requests || []) as AcceptedRequest[]
    for (const request of accepted) {
      const friendId = request.sender_id === id ? request.receiver_id : request.sender_id
      const a = id < friendId ? id : friendId
      const b = id < friendId ? friendId : id
      if (existingPairs.has(`${a}:${b}`)) continue

      const { data: conversationId, error: createError } = await supabase.rpc('ensure_conversation', {
        p_user_a: request.sender_id,
        p_user_b: request.receiver_id,
      })
      if (createError) {
        setError(createError.message)
        continue
      }
      if (conversationId) {
        ;(conversationRows as Conversation[]).push({
          id: conversationId as string,
          user_a: a,
          user_b: b,
          created_at: request.created_at,
          updated_at: request.created_at,
        })
        existingPairs.add(`${a}:${b}`)
      }
    }

    const rows = (conversationRows || []) as Conversation[]
    const friendIds = [...new Set(accepted.map(r => r.sender_id === id ? r.receiver_id : r.sender_id))]

    const people: Record<string, Person> = {}
    if (friendIds.length) {
      const { data: profiles, error: profileError } = await supabase.from('profiles')
        .select('id,full_name,bio,avatar_url')
        .in('id', friendIds)
      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
      ;(profiles || []).forEach(profile => { people[profile.id] = profile as Person })
    }

    const finalConvos = rows
      .filter(c => {
        const friendId = c.user_a === id ? c.user_b : c.user_a
        return friendIds.includes(friendId)
      })
      .map(c => ({ ...c, other: people[c.user_a === id ? c.user_b : c.user_a] }))
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())

    setConvos(finalConvos)
    setLoading(false)
    setSelected(current => current && finalConvos.some(c => c.id === current) ? current : finalConvos[0]?.id || '')
  }

  async function loadMessages(conversationId: string) {
    setError('')
    const { data, error: queryError } = await supabase.from('messages')
      .select(SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      setMessages([])
      return
    }

    setMessages(await hydrate((data || []) as Message[]))
  }

  useEffect(() => { void loadFriendsAndConversations() }, [supabase])

  useEffect(() => {
    if (!selected) return
    void loadMessages(selected)
    setMobileList(false)
  }, [selected, supabase])

  useEffect(() => {
    if (!selected) return
    const channel = supabase.channel(`messages:${selected}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected}`,
      }, async payload => {
        const row = payload.new as Message
        const hydrated = { ...row, media_url: await getMediaUrl(row.media_path) }
        setMessages(previous => previous.some(m => m.id === hydrated.id) ? previous : [...previous, hydrated])
        setConvos(previous => previous.map(c => c.id === selected ? { ...c, updated_at: hydrated.created_at } : c))
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected}`,
      }, payload => {
        setMessages(previous => previous.map(m => m.id === payload.new.id ? { ...m, ...(payload.new as Message) } : m))
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [selected, supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, selected])

  async function send() {
    const body = text.trim()
    if (!body || !selected || !userId || busy) return
    setBusy(true)
    setError('')

    const { data, error: insertError } = await supabase.from('messages')
      .insert({
        conversation_id: selected,
        sender_id: userId,
        body,
        message_type: 'text',
        delivered_at: new Date().toISOString(),
      })
      .select(SELECT)
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      const hydrated = (await hydrate([data as Message]))[0]
      setMessages(previous => previous.some(m => m.id === hydrated.id) ? previous : [...previous, hydrated])
      setConvos(previous => previous.map(c => c.id === selected ? { ...c, updated_at: hydrated.created_at } : c))
      setText('')
    }

    setBusy(false)
  }

  async function upload(file: File) {
    if (!file || !selected || !userId || busy) return
    setBusy(true)
    setError('')
    try {
      const type = file.type.startsWith('image/') ? 'image' : 'document'
      const extension = file.name.split('.').pop() || 'bin'
      const path = `${userId}/${selected}/${crypto.randomUUID()}.${extension}`
      const uploadResult = await supabase.storage.from('message-media').upload(path, file, { contentType: file.type || undefined })
      if (uploadResult.error) throw uploadResult.error

      const { data, error: insertError } = await supabase.from('messages')
        .insert({
          conversation_id: selected,
          sender_id: userId,
          body: '',
          message_type: type,
          media_path: path,
          media_name: file.name,
          media_size: file.size,
          mime_type: file.type,
          delivered_at: new Date().toISOString(),
        })
        .select(SELECT)
        .single()

      if (insertError) {
        await supabase.storage.from('message-media').remove([path])
        throw insertError
      }

      if (data) {
        const hydrated = (await hydrate([data as Message]))[0]
        setMessages(previous => previous.some(m => m.id === hydrated.id) ? previous : [...previous, hydrated])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Attachment failed.')
    } finally {
      setBusy(false)
      if (fileInput) fileInput.value = ''
    }
  }

  const filtered = convos.filter(c => !search || c.other?.full_name?.toLowerCase().includes(search.toLowerCase()))

  const renderBody = (message: Message) => {
    if (message.deleted_at) return <i className="wa-deleted">This message was deleted</i>
    if (message.message_type === 'image') return message.media_url
      ? <img className="wa-message-image" src={message.media_url} alt={message.media_name || 'Image'} />
      : <span>Loading image…</span>
    if (message.message_type === 'document') return <a className="wa-document" href={message.media_url || '#'} target="_blank" rel="noreferrer">
      <span className="wa-document-icon"><FileText size={18} /></span>
      <span><b>{message.media_name || 'Document'}</b><small>{bytes(message.media_size)} · Open document</small></span>
    </a>
    if (message.message_type === 'audio') return <audio controls src={message.media_url || ''} />
    return <span className="wa-text">{message.body}</span>
  }

  return (
    <div className="wa-page">
      <AppSidebar />
      <main className="wa-main">
        <div className="wa-heading">
          <p>YOUR CONNECTIONS</p>
          <h1>Chats</h1>
          <span>Chat with your SkillSwap friends after you accept a swap request.</span>
        </div>

        {error ? <div className="wa-error">{error}</div> : null}

        <section className="wa-card">
          <aside className={`wa-list ${mobileList ? '' : 'wa-list-mobile-hidden'}`}>
            <div className="wa-list-head">
              <div className="wa-list-title">
                <div><p>YOUR FRIENDS</p><h2>Chats</h2></div>
                <b>{convos.length}</b>
              </div>
              <label><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends" /></label>
            </div>
            <div className="wa-list-body">
              {loading ? <div className="wa-empty"><LoaderCircle className="wa-spin" size={24} /><span>Loading your friends…</span></div> : filtered.length === 0 ? <div className="wa-empty"><UserRound size={34} /><strong>No friends to message yet.</strong><a href="/explore">Find someone to swap skills with.</a></div> : filtered.map(c => <button key={c.id} className={`wa-convo ${selected === c.id ? 'active' : ''}`} onClick={() => { setSelected(c.id); setMobileList(false) }}>
                <span className="wa-avatar">{c.other?.avatar_url ? <img src={c.other.avatar_url} alt="" /> : initials(c.other?.full_name || 'SkillSwap member')}</span>
                <span className="wa-convo-copy"><b>{c.other?.full_name || 'SkillSwap member'}</b><small>SkillSwap friend</small></span>
                <time>{time(c.updated_at || c.created_at)}</time>
              </button>)}
            </div>
          </aside>

          <section className={`wa-chat ${mobileList ? 'wa-chat-mobile-hidden' : ''}`}>
            {other ? <>
              <header className="wa-chat-head">
                <button className="wa-back" onClick={() => setMobileList(true)}><ChevronLeft size={20} /></button>
                <button className="wa-person" onClick={() => window.location.assign(`/people/${other.id}`)}>
                  <span className="wa-avatar">{other.avatar_url ? <img src={other.avatar_url} alt="" /> : initials(other.full_name)}</span>
                  <span><b>{other.full_name}</b><small>SkillSwap friend</small></span>
                </button>
                <button className="wa-profile" onClick={() => window.location.assign(`/people/${other.id}`)}><UserRound size={18} /></button>
              </header>

              <div className="wa-messages">
                <div className="wa-encrypted">MESSAGES ARE ENCRYPTED BETWEEN YOU</div>
                {messages.length === 0 ? <div className="wa-start"><div>✦</div><h2>Start the conversation</h2><p>You are connected. Say hello and start your skill swap.</p></div> : <div className="wa-message-stack">
                  {messages.map(message => {
                    const mine = message.sender_id === userId
                    return <div key={message.id} className={`wa-row ${mine ? 'mine' : ''}`}>
                      <div className={`wa-bubble ${mine ? 'mine' : ''}`}>
                        {renderBody(message)}
                        <footer><span>{time(message.created_at)}</span>{mine ? <span className={message.read_at ? 'wa-read' : ''}>✓✓</span> : null}</footer>
                      </div>
                    </div>
                  })}
                  <div ref={bottomRef} />
                </div>}
              </div>

              <div className="wa-composer">
                <div className="wa-input">
                  <button disabled={busy} onClick={() => fileInput?.click()}><Paperclip size={19} /></button>
                  <input ref={setFileInput} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.ppt,.pptx,.xls,.xlsx" className="wa-hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file) }} />
                  <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder="Write a message..." disabled={busy} />
                  {text.trim() ? <button className="wa-send" disabled={busy} onClick={() => void send()}><Send size={17} /></button> : <button disabled title="Type a message to send"><Mic size={19} /></button>}
                </div>
              </div>
            </> : <div className="wa-no-selection"><div><ImageIcon size={30} /><p>Select a friend to start chatting.</p></div></div>}
          </section>
        </section>
      </main>
    </div>
  )
}
