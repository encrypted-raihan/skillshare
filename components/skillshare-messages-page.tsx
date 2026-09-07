'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search, Send, UserRound } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  full_name: string
  avatar_url: string | null
}

type Conversation = {
  id: string
  user_a: string
  user_b: string
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?'

const time = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function SkillSwapMessagesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [friends, setFriends] = useState<Person[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Person | null>(null)
  const [selectedConversation, setSelectedConversation] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        window.location.replace('/auth/login?next=/messages')
        return
      }

      const id = auth.user.id
      setUserId(id)

      const { data: requests, error: requestError } = await supabase
        .from('swap_requests')
        .select('sender_id,receiver_id')
        .eq('status', 'ACCEPTED')
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)

      if (requestError) {
        if (!cancelled) setError(requestError.message)
        setLoading(false)
        return
      }

      const friendIds = [...new Set((requests || []).map(row =>
        row.sender_id === id ? row.receiver_id : row.sender_id
      ))]

      if (!friendIds.length) {
        if (!cancelled) {
          setFriends([])
          setConversations([])
          setSelectedFriend(null)
          setSelectedConversation('')
        }
        setLoading(false)
        return
      }

      const [{ data: profiles, error: profileError }, { data: convos, error: convoError }] = await Promise.all([
        supabase.from('profiles').select('id,full_name,avatar_url').in('id', friendIds),
        supabase.from('conversations').select('id,user_a,user_b').or(`user_a.eq.${id},user_b.eq.${id}`),
      ])

      if (profileError || convoError) {
        if (!cancelled) setError((profileError || convoError)?.message || 'Could not load chats.')
        setLoading(false)
        return
      }

      const nextFriends = (profiles || []) as Person[]
      if (!cancelled) {
        setFriends(nextFriends)
        setConversations((convos || []) as Conversation[])
        setSelectedFriend(current => current && nextFriends.some(friend => friend.id === current.id) ? current : null)
      }
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [supabase])

  async function openChat(friend: Person) {
    setError('')
    setSelectedFriend(friend)
    setMessages([])

    const existing = conversations.find(conversation =>
      (conversation.user_a === userId && conversation.user_b === friend.id) ||
      (conversation.user_b === userId && conversation.user_a === friend.id)
    )

    if (existing) {
      setSelectedConversation(existing.id)
      return
    }

    const { data, error: rpcError } = await supabase.rpc('ensure_conversation', {
      p_user_a: userId,
      p_user_b: friend.id,
    })

    if (rpcError || !data) {
      setError(rpcError?.message || 'Could not start this conversation.')
      setSelectedFriend(null)
      return
    }

    const conversation = { id: data as string, user_a: userId, user_b: friend.id }
    setConversations(current => [...current, conversation])
    setSelectedConversation(conversation.id)
  }

  useEffect(() => {
    if (!selectedConversation) return

    async function loadMessages() {
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true })

      if (queryError) {
        setError(queryError.message)
        return
      }
      setMessages((data || []) as Message[])
    }

    void loadMessages()

    const channel = supabase
      .channel(`chat-${selectedConversation}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversation}`,
      }, payload => {
        const message = payload.new as Message
        setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [selectedConversation, supabase])

  async function sendMessage() {
    const body = text.trim()
    if (!body || !selectedConversation || !userId || sending) return

    setSending(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({ conversation_id: selectedConversation, sender_id: userId, body })
      .select('id,conversation_id,sender_id,body,created_at')
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      const message = data as Message
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message])
      setText('')
    }

    setSending(false)
  }

  const filteredFriends = friends.filter(friend =>
    friend.full_name?.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div style={styles.page}>
      <AppSidebar />
      <main style={styles.main}>
        <div style={styles.heading}>
          <p style={styles.eyebrow}>YOUR CONNECTIONS</p>
          <h1 style={styles.title}>Chats</h1>
          <p style={styles.subtitle}>Simple, reliable messaging between accepted SkillSwap friends.</p>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <section style={styles.chatShell}>
          <aside style={styles.friendPanel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitleRow}>
                <div>
                  <p style={styles.smallLabel}>YOUR FRIENDS</p>
                  <h2 style={styles.panelTitle}>Chats</h2>
                </div>
                <span style={styles.count}>{friends.length}</span>
              </div>
              <div style={styles.searchBox}>
                <Search size={17} />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search friends" style={styles.searchInput} />
              </div>
            </div>

            <div style={styles.friendList}>
              {loading ? <div style={styles.empty}>Loading your friends…</div> : filteredFriends.length === 0 ? (
                <div style={styles.empty}>{friends.length ? 'No friends match your search.' : 'No accepted friends yet.'}</div>
              ) : filteredFriends.map(friend => (
                <button key={friend.id} onClick={() => void openChat(friend)} style={{ ...styles.friend, ...(selectedFriend?.id === friend.id ? styles.friendActive : {}) }}>
                  <Avatar person={friend} />
                  <span style={styles.friendCopy}>
                    <strong>{friend.full_name}</strong>
                    <small>SkillSwap friend</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section style={styles.chatPanel}>
            {!selectedFriend ? (
              <div style={styles.placeholder}>
                <div style={styles.placeholderIcon}><UserRound size={30} /></div>
                <h2>Select a friend</h2>
                <p>Choose an accepted SkillSwap friend to start chatting.</p>
              </div>
            ) : (
              <>
                <header style={styles.chatHeader}>
                  <button onClick={() => setSelectedFriend(null)} style={styles.backButton} aria-label="Back"><ArrowLeft size={19} /></button>
                  <Avatar person={selectedFriend} />
                  <div style={styles.headerCopy}>
                    <strong>{selectedFriend.full_name}</strong>
                    <small>SkillSwap friend</small>
                  </div>
                </header>

                <div style={styles.messages}>
                  {messages.length === 0 ? (
                    <div style={styles.startChat}>
                      <h3>Start the conversation</h3>
                      <p>Say hello and begin your skill swap.</p>
                    </div>
                  ) : messages.map(message => {
                    const mine = message.sender_id === userId
                    return (
                      <div key={message.id} style={{ ...styles.messageRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{ ...styles.bubble, ...(mine ? styles.mine : styles.theirs) }}>
                          <div>{message.body}</div>
                          <time style={styles.messageTime}>{time(message.created_at)}</time>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <form onSubmit={event => { event.preventDefault(); void sendMessage() }} style={styles.composer}>
                  <input value={text} onChange={event => setText(event.target.value)} placeholder="Write a message…" style={styles.composerInput} />
                  <button type="submit" disabled={!text.trim() || sending} style={styles.sendButton} aria-label="Send message"><Send size={18} /></button>
                </form>
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}

function Avatar({ person }: { person: Person }) {
  return person.avatar_url ? (
    <img src={person.avatar_url} alt="" style={styles.avatar} />
  ) : (
    <span style={styles.avatarFallback}>{initials(person.full_name)}</span>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f8f5', color: '#17352b' },
  main: { marginLeft: 248, padding: '42px 34px 50px', minHeight: '100vh' },
  heading: { maxWidth: 1100, margin: '0 auto 26px' },
  eyebrow: { margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 3, color: '#718279' },
  title: { margin: '8px 0 4px', fontSize: 62, lineHeight: 0.98, letterSpacing: -3, fontWeight: 850 },
  subtitle: { margin: 0, color: '#64756d', fontSize: 16 },
  error: { maxWidth: 1100, margin: '0 auto 14px', padding: '12px 14px', borderRadius: 12, background: '#fff0ee', color: '#a43b2f', fontSize: 14 },
  chatShell: { maxWidth: 1100, height: 'min(690px, calc(100vh - 220px))', minHeight: 500, margin: '0 auto', display: 'grid', gridTemplateColumns: '340px 1fr', overflow: 'hidden', border: '1px solid #dce5df', borderRadius: 26, background: '#fff', boxShadow: '0 18px 55px rgba(30,65,52,.08)' },
  friendPanel: { display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #e1e8e3' },
  panelHeader: { padding: 20, borderBottom: '1px solid #e7ece9' },
  panelTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  smallLabel: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#809087' },
  panelTitle: { margin: '4px 0 14px', fontSize: 30, letterSpacing: -1.2 },
  count: { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 99, background: '#e6f1eb', color: '#14523e', fontWeight: 800, fontSize: 13 },
  searchBox: { height: 44, display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px', border: '1px solid #dce5df', borderRadius: 12, color: '#819088' },
  searchInput: { width: '100%', border: 0, outline: 0, background: 'transparent', fontSize: 14, color: '#17352b' },
  friendList: { flex: 1, overflowY: 'auto', padding: 8 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#809087', fontSize: 14 },
  friend: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: 0, borderRadius: 14, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#17352b' },
  friendActive: { background: '#eaf3ee' },
  friendCopy: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  avatar: { width: 44, height: 44, flex: '0 0 44px', borderRadius: '50%', objectFit: 'cover' },
  avatarFallback: { width: 44, height: 44, flex: '0 0 44px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#d9e9e0', color: '#18543f', fontWeight: 800 },
  chatPanel: { display: 'flex', flexDirection: 'column', minWidth: 0, background: '#fbfdfb' },
  placeholder: { flex: 1, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, textAlign: 'center', color: '#718279' },
  placeholderIcon: { width: 64, height: 64, display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#e7f1eb', color: '#17543f' },
  chatHeader: { height: 78, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', borderBottom: '1px solid #e1e8e3', background: '#fff' },
  backButton: { display: 'none', border: 0, background: 'transparent', cursor: 'pointer' },
  headerCopy: { display: 'flex', flexDirection: 'column', gap: 3 },
  messages: { flex: 1, overflowY: 'auto', padding: 24 },
  startChat: { height: '100%', display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', color: '#809087' },
  messageRow: { display: 'flex', marginBottom: 10 },
  bubble: { maxWidth: '72%', padding: '10px 13px', borderRadius: 16, fontSize: 14, lineHeight: 1.45 },
  mine: { background: '#15533f', color: '#fff', borderBottomRightRadius: 4 },
  theirs: { background: '#e9f0ec', color: '#17352b', borderBottomLeftRadius: 4 },
  messageTime: { display: 'block', marginTop: 4, fontSize: 10, opacity: 0.65, textAlign: 'right' },
  composer: { display: 'flex', gap: 10, padding: 14, borderTop: '1px solid #e1e8e3', background: '#fff' },
  composerInput: { flex: 1, minWidth: 0, height: 44, border: '1px solid #dce5df', borderRadius: 12, padding: '0 13px', outline: 0, fontSize: 14, color: '#17352b' },
  sendButton: { width: 44, height: 44, display: 'grid', placeItems: 'center', border: 0, borderRadius: 12, background: '#15533f', color: '#fff', cursor: 'pointer' },
}
