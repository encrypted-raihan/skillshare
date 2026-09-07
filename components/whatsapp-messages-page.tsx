'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, MessageCircle, Search, Send, UserRound } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  full_name: string
  bio: string | null
  avatar_url: string | null
}

type FriendRequest = {
  id: string
  sender_id: string
  receiver_id: string
  created_at: string
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S'

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function WhatsAppMessagesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [friends, setFriends] = useState<Person[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [loadingChat, setLoadingChat] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || null
  const filteredFriends = friends.filter((friend) =>
    friend.full_name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  async function loadFriends() {
    setLoadingFriends(true)
    setError('')

    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) {
      window.location.replace('/auth/login?next=/messages')
      return
    }

    const id = auth.user.id
    setUserId(id)

    const { data: requests, error: requestError } = await supabase
      .from('swap_requests')
      .select('id,sender_id,receiver_id,created_at')
      .eq('status', 'ACCEPTED')
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
      .order('created_at', { ascending: false })

    if (requestError) {
      setError(requestError.message)
      setLoadingFriends(false)
      return
    }

    const rows = (requests || []) as FriendRequest[]
    const friendIds = [...new Set(rows.map((row) => row.sender_id === id ? row.receiver_id : row.sender_id))]

    if (!friendIds.length) {
      setFriends([])
      setSelectedFriendId('')
      setLoadingFriends(false)
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id,full_name,bio,avatar_url')
      .in('id', friendIds)

    if (profileError) {
      setError(profileError.message)
      setLoadingFriends(false)
      return
    }

    const byId = new Map((profiles || []).map((profile) => [profile.id, profile as Person]))
    const nextFriends = friendIds
      .map((friendId) => byId.get(friendId))
      .filter((friend): friend is Person => Boolean(friend))

    setFriends(nextFriends)
    setLoadingFriends(false)

    const params = new URLSearchParams(window.location.search)
    const requestedFriend = params.get('friend')
    const nextFriend = requestedFriend && nextFriends.some((friend) => friend.id === requestedFriend)
      ? requestedFriend
      : nextFriends[0]?.id || ''

    if (nextFriend) {
      await openFriend(nextFriend, id)
    }
  }

  async function ensureConversation(friendId: string, currentUserId = userId) {
    const { data, error: rpcError } = await supabase.rpc('ensure_conversation', {
      p_user_a: currentUserId,
      p_user_b: friendId,
    })

    if (rpcError) throw rpcError
    if (!data) throw new Error('Conversation could not be created.')
    return data as string
  }

  async function loadMessages(id: string) {
    const { data, error: messageError } = await supabase
      .from('messages')
      .select('id,conversation_id,sender_id,body,created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (messageError) throw messageError
    setMessages((data || []) as Message[])
  }

  async function openFriend(friendId: string, currentUserId = userId) {
    if (!currentUserId) return

    setSelectedFriendId(friendId)
    setConversationId('')
    setMessages([])
    setError('')
    setLoadingChat(true)

    try {
      const id = await ensureConversation(friendId, currentUserId)
      setConversationId(id)
      await loadMessages(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this chat.')
    } finally {
      setLoadingChat(false)
    }
  }

  useEffect(() => {
    void loadFriends()
  }, [supabase])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`skillshare-chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as Message
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, conversationId])

  async function sendMessage() {
    const body = text.trim()
    if (!body || !selectedFriendId || !userId || sending || loadingChat) return

    setSending(true)
    setError('')

    try {
      const id = conversationId || await ensureConversation(selectedFriendId)
      if (!conversationId) setConversationId(id)

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          sender_id: userId,
          body,
        })
        .select('id,conversation_id,sender_id,body,created_at')
        .single()

      if (insertError) throw insertError
      if (data) {
        const message = data as Message
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      }
      setText('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-v2-page">
      <AppSidebar />

      <main className="chat-v2-main">
        <header className="chat-v2-header">
          <p>YOUR CONNECTIONS</p>
          <h1>Messages</h1>
          <span>Chat with your accepted SkillSwap friends.</span>
        </header>

        {error ? <div className="chat-v2-error">{error}</div> : null}

        <section className="chat-v2-shell">
          <aside className="chat-v2-friends">
            <div className="chat-v2-section-title">
              <div>
                <small>YOUR FRIENDS</small>
                <h2>Friends</h2>
              </div>
              <b>{friends.length}</b>
            </div>

            <label className="chat-v2-search">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search friends" />
            </label>

            <div className="chat-v2-friend-list">
              {loadingFriends ? (
                <div className="chat-v2-empty"><LoaderCircle className="chat-v2-spin" size={22} /> Loading friends…</div>
              ) : filteredFriends.length === 0 ? (
                <div className="chat-v2-empty"><UserRound size={26} /><strong>No friends yet.</strong><span>Accept a swap request first.</span></div>
              ) : (
                filteredFriends.map((friend) => (
                  <button
                    type="button"
                    key={friend.id}
                    className={`chat-v2-friend ${selectedFriendId === friend.id ? 'active' : ''}`}
                    onClick={() => void openFriend(friend.id)}
                  >
                    <span className="chat-v2-avatar">
                      {friend.avatar_url ? <img src={friend.avatar_url} alt="" /> : initials(friend.full_name)}
                    </span>
                    <span className="chat-v2-friend-copy">
                      <strong>{friend.full_name}</strong>
                      <small>SkillSwap friend</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="chat-v2-conversation">
            {!selectedFriend ? (
              <div className="chat-v2-no-selection">
                <MessageCircle size={34} />
                <h2>Select a friend</h2>
                <p>Your accepted SkillSwap friends appear on the left.</p>
              </div>
            ) : (
              <>
                <header className="chat-v2-chat-header">
                  <span className="chat-v2-avatar large">
                    {selectedFriend.avatar_url ? <img src={selectedFriend.avatar_url} alt="" /> : initials(selectedFriend.full_name)}
                  </span>
                  <div>
                    <strong>{selectedFriend.full_name}</strong>
                    <small>SkillSwap friend</small>
                  </div>
                </header>

                <div className="chat-v2-messages">
                  <div className="chat-v2-note">Messaging is available only after a swap request is accepted.</div>

                  {loadingChat ? (
                    <div className="chat-v2-empty"><LoaderCircle className="chat-v2-spin" size={22} /> Opening chat…</div>
                  ) : messages.length === 0 ? (
                    <div className="chat-v2-empty conversation-empty">
                      <MessageCircle size={28} />
                      <strong>Start the conversation</strong>
                      <span>Send the first message below.</span>
                    </div>
                  ) : (
                    <div className="chat-v2-message-list">
                      {messages.map((message) => {
                        const mine = message.sender_id === userId
                        return (
                          <div key={message.id} className={`chat-v2-row ${mine ? 'mine' : ''}`}>
                            <div className={`chat-v2-bubble ${mine ? 'mine' : ''}`}>
                              <span>{message.body}</span>
                              <time>{formatTime(message.created_at)}</time>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <form
                  className="chat-v2-composer"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void sendMessage()
                  }}
                >
                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Type a message…"
                    disabled={loadingChat || sending}
                  />
                  <button type="submit" disabled={loadingChat || sending || !text.trim()} aria-label="Send message">
                    {sending ? <LoaderCircle className="chat-v2-spin" size={18} /> : <Send size={18} />}
                  </button>
                </form>
              </>
            )}
          </section>
        </section>

        <style jsx>{`
          .chat-v2-page { min-height: 100vh; display: grid; grid-template-columns: auto minmax(0, 1fr); background: #f4f7f5; color: #10211a; }
          .chat-v2-main { min-width: 0; padding: 54px 48px; }
          .chat-v2-header { max-width: 900px; margin: 0 auto 28px; }
          .chat-v2-header p, .chat-v2-section-title small { margin: 0; font-size: 11px; font-weight: 900; letter-spacing: .22em; color: #52705f; }
          .chat-v2-header h1 { margin: 8px 0 10px; font-size: clamp(42px, 6vw, 68px); line-height: .96; letter-spacing: -.055em; }
          .chat-v2-header > span { color: #6b7971; font-size: 15px; }
          .chat-v2-error { max-width: 900px; margin: 0 auto 14px; padding: 12px 14px; border: 1px solid #efc9c4; border-radius: 12px; color: #9a4037; background: #fff4f2; }
          .chat-v2-shell { max-width: 1100px; height: min(720px, calc(100vh - 210px)); min-height: 520px; margin: 0 auto; display: grid; grid-template-columns: 310px minmax(0, 1fr); overflow: hidden; border: 1px solid rgba(33,58,46,.12); border-radius: 24px; background: rgba(255,255,255,.9); box-shadow: 0 24px 60px rgba(40,63,52,.08); }
          .chat-v2-friends { min-width: 0; border-right: 1px solid rgba(33,58,46,.1); display: flex; flex-direction: column; }
          .chat-v2-section-title { padding: 22px 20px 14px; display: flex; justify-content: space-between; align-items: flex-start; }
          .chat-v2-section-title h2 { margin: 5px 0 0; font-size: 27px; letter-spacing: -.04em; }
          .chat-v2-section-title b { min-width: 32px; height: 32px; padding: 0 8px; border-radius: 50%; display: grid; place-items: center; background: #e1efe7; color: #17563e; font-size: 12px; }
          .chat-v2-search { margin: 0 16px 12px; min-height: 46px; display: flex; align-items: center; gap: 10px; padding: 0 13px; border: 1px solid rgba(33,58,46,.12); border-radius: 13px; background: #fff; color: #849087; }
          .chat-v2-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #10211a; }
          .chat-v2-friend-list { min-height: 0; overflow: auto; padding: 0 8px 8px; }
          .chat-v2-friend { width: 100%; border: 0; border-radius: 15px; background: transparent; display: flex; align-items: center; gap: 11px; padding: 11px 10px; text-align: left; color: inherit; }
          .chat-v2-friend:hover, .chat-v2-friend.active { background: #edf5ef; }
          .chat-v2-avatar { width: 42px; height: 42px; flex: 0 0 42px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; background: #dcebe2; color: #17563e; font-weight: 850; }
          .chat-v2-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .chat-v2-avatar.large { width: 46px; height: 46px; flex-basis: 46px; }
          .chat-v2-friend-copy, .chat-v2-chat-header > div { min-width: 0; display: grid; gap: 3px; }
          .chat-v2-friend-copy strong, .chat-v2-chat-header strong { font-size: 14px; }
          .chat-v2-friend-copy small, .chat-v2-chat-header small { color: #79877f; font-size: 11px; }
          .chat-v2-conversation { min-width: 0; display: flex; flex-direction: column; }
          .chat-v2-chat-header { min-height: 74px; padding: 14px 18px; display: flex; align-items: center; gap: 11px; border-bottom: 1px solid rgba(33,58,46,.1); }
          .chat-v2-messages { min-height: 0; flex: 1; overflow: auto; padding: 18px; }
          .chat-v2-note { width: fit-content; max-width: 100%; margin: 0 auto 18px; padding: 8px 10px; border-radius: 999px; background: #edf4ef; color: #60736a; font-size: 11px; }
          .chat-v2-message-list { display: grid; gap: 8px; }
          .chat-v2-row { display: flex; justify-content: flex-start; }
          .chat-v2-row.mine { justify-content: flex-end; }
          .chat-v2-bubble { max-width: min(72%, 560px); padding: 10px 12px; border-radius: 16px 16px 16px 5px; background: #eff3f0; color: #1c2b24; }
          .chat-v2-bubble.mine { border-radius: 16px 16px 5px 16px; background: #173f31; color: #fff; }
          .chat-v2-bubble > span { display: block; white-space: pre-wrap; line-height: 1.45; font-size: 14px; }
          .chat-v2-bubble time { display: block; margin-top: 5px; opacity: .62; font-size: 10px; text-align: right; }
          .chat-v2-composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(33,58,46,.1); }
          .chat-v2-composer input { min-width: 0; flex: 1; height: 46px; padding: 0 13px; border: 1px solid rgba(33,58,46,.13); border-radius: 14px; outline: 0; background: #fff; color: #10211a; }
          .chat-v2-composer input:focus { border-color: #1f6a4c; box-shadow: 0 0 0 4px rgba(31,106,76,.08); }
          .chat-v2-composer button { width: 46px; height: 46px; border: 0; border-radius: 14px; display: grid; place-items: center; background: #1f6a4c; color: #fff; }
          .chat-v2-composer button:disabled { opacity: .45; cursor: not-allowed; }
          .chat-v2-empty, .chat-v2-no-selection { min-height: 180px; display: grid; place-items: center; align-content: center; gap: 8px; color: #849087; text-align: center; padding: 28px; }
          .chat-v2-empty strong, .chat-v2-no-selection h2 { color: #31453b; font-size: 14px; }
          .chat-v2-empty span, .chat-v2-no-selection p { margin: 0; font-size: 12px; }
          .chat-v2-no-selection { height: 100%; }
          .chat-v2-no-selection h2 { margin: 0; font-size: 20px; }
          .chat-v2-spin { animation: chat-v2-spin .8s linear infinite; }
          @keyframes chat-v2-spin { to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            .chat-v2-page { grid-template-columns: 1fr; }
            .chat-v2-main { padding: 28px 16px; }
            .chat-v2-shell { height: calc(100vh - 175px); min-height: 0; grid-template-columns: 250px minmax(0, 1fr); }
          }
        `}</style>
      </main>
    </div>
  )
}
