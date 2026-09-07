'use client'

import { useEffect, useMemo, useState } from 'react'
import { Send, UserRound } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Friend = { id: string; full_name: string; avatar_url: string | null }
type Conversation = { id: string; user_a: string; user_b: string }
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?'
const clock = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function MessagesV2Page() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Friend | null>(null)
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { window.location.replace('/auth/login?next=/messages'); return }
      setUserId(auth.user.id)

      const { data: requests, error: requestError } = await supabase.from('swap_requests')
        .select('sender_id,receiver_id').eq('status', 'ACCEPTED')
        .or(`sender_id.eq.${auth.user.id},receiver_id.eq.${auth.user.id}`)
      if (requestError) { setError(requestError.message); setLoading(false); return }

      const ids = [...new Set((requests || []).map(r => r.sender_id === auth.user.id ? r.receiver_id : r.sender_id))]
      if (!ids.length) { setLoading(false); return }

      const [{ data: people, error: peopleError }, { data: chats, error: chatsError }] = await Promise.all([
        supabase.from('profiles').select('id,full_name,avatar_url').in('id', ids),
        supabase.from('conversations').select('id,user_a,user_b').or(`user_a.eq.${auth.user.id},user_b.eq.${auth.user.id}`),
      ])
      if (peopleError || chatsError) { setError((peopleError || chatsError)?.message || 'Could not load chats.'); setLoading(false); return }
      setFriends((people || []) as Friend[])
      setConversations((chats || []) as Conversation[])
      setLoading(false)
    }
    void load()
  }, [supabase])

  async function selectFriend(friend: Friend) {
    setSelected(friend); setMessages([]); setError('')
    let chat = conversations.find(c => (c.user_a === userId && c.user_b === friend.id) || (c.user_b === userId && c.user_a === friend.id))
    if (!chat) {
      const { data, error: rpcError } = await supabase.rpc('ensure_conversation', { p_user_a: userId, p_user_b: friend.id })
      if (rpcError || !data) { setError(rpcError?.message || 'Could not start conversation.'); return }
      chat = { id: data as string, user_a: userId, user_b: friend.id }
      setConversations(current => [...current, chat!])
    }
    setConversationId(chat.id)
  }

  useEffect(() => {
    if (!conversationId) return
    async function loadMessages() {
      const { data, error: queryError } = await supabase.from('messages')
        .select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversationId).order('created_at')
      if (queryError) setError(queryError.message); else setMessages((data || []) as Message[])
    }
    void loadMessages()
    const channel = supabase.channel(`messages-${conversationId}`).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}`
    }, payload => {
      const next = payload.new as Message
      setMessages(current => current.some(m => m.id === next.id) ? current : [...current, next])
    }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [conversationId, supabase])

  async function send() {
    const body = text.trim()
    if (!body || !conversationId) return
    const { data, error: insertError } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body }).select('id,conversation_id,sender_id,body,created_at').single()
    if (insertError) { setError(insertError.message); return }
    if (data) setMessages(current => current.some(m => m.id === data.id) ? current : [...current, data as Message])
    setText('')
  }

  const visible = friends.filter(f => f.full_name.toLowerCase().includes(search.toLowerCase().trim()))

  return <div style={s.page}>
    <AppSidebar />
    <main style={s.main}>
      <div style={s.heading}><div style={s.eyebrow}>YOUR CONNECTIONS</div><h1 style={s.h1}>Chats</h1><p style={s.sub}>Messaging is limited to accepted SkillSwap friends.</p></div>
      {error && <div style={s.error}>{error}</div>}
      <section style={s.shell}>
        <aside style={s.list}>
          <div style={s.listHead}><b style={s.label}>YOUR FRIENDS</b><h2 style={s.h2}>Chats <span style={s.badge}>{friends.length}</span></h2><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends" style={s.search} /></div>
          <div style={s.friendList}>{loading ? <p style={s.empty}>Loading your friends…</p> : visible.length ? visible.map(friend => <button key={friend.id} onClick={() => void selectFriend(friend)} style={{ ...s.friend, ...(selected?.id === friend.id ? s.active : {}) }}><Avatar friend={friend} /><span><strong>{friend.full_name}</strong><small>SkillSwap friend</small></span></button>) : <p style={s.empty}>{friends.length ? 'No matches.' : 'No accepted friends yet.'}</p>}</div>
        </aside>
        <section style={s.chat}>
          {!selected ? <div style={s.placeholder}><div style={s.icon}><UserRound size={28} /></div><h2>Select a friend</h2><p>Choose an accepted friend to start chatting.</p></div> : <>
            <header style={s.header}><Avatar friend={selected} /><span><strong>{selected.full_name}</strong><small>SkillSwap friend</small></span></header>
            <div style={s.messages}>{messages.length ? messages.map(m => <div key={m.id} style={{ ...s.row, justifyContent: m.sender_id === userId ? 'flex-end' : 'flex-start' }}><div style={{ ...s.bubble, ...(m.sender_id === userId ? s.mine : s.theirs) }}><div>{m.body}</div><small style={s.time}>{clock(m.created_at)}</small></div></div>) : <div style={s.start}><h3>Start the conversation</h3><p>Say hello and begin your skill swap.</p></div>}</div>
            <form onSubmit={e => { e.preventDefault(); void send() }} style={s.composer}><input value={text} onChange={e => setText(e.target.value)} placeholder="Write a message…" style={s.input} /><button type="submit" disabled={!text.trim()} style={s.send}><Send size={18} /></button></form>
          </>}
        </section>
      </section>
    </main>
  </div>
}

function Avatar({ friend }: { friend: Friend }) { return friend.avatar_url ? <img src={friend.avatar_url} alt="" style={s.avatar} /> : <span style={s.avatar}>{initials(friend.full_name)}</span> }

const s: Record<string, React.CSSProperties> = {
  page:{minHeight:'100vh',background:'#f5f8f5',color:'#17352b'},main:{marginLeft:248,padding:'42px 34px 50px'},heading:{maxWidth:1100,margin:'0 auto 24px'},eyebrow:{fontSize:11,fontWeight:800,letterSpacing:3,color:'#718279'},h1:{fontSize:62,lineHeight:1,letterSpacing:-3,margin:'8px 0 5px'},sub:{margin:0,color:'#64756d'},error:{maxWidth:1100,margin:'0 auto 12px',padding:12,borderRadius:10,background:'#fff0ee',color:'#a43b2f'},shell:{maxWidth:1100,height:'min(680px,calc(100vh - 210px))',minHeight:500,margin:'0 auto',display:'grid',gridTemplateColumns:'340px 1fr',overflow:'hidden',border:'1px solid #dce5df',borderRadius:26,background:'#fff',boxShadow:'0 18px 55px rgba(30,65,52,.08)'},list:{borderRight:'1px solid #e1e8e3',display:'flex',flexDirection:'column',minWidth:0},listHead:{padding:20,borderBottom:'1px solid #e7ece9'},label:{fontSize:10,letterSpacing:2,color:'#809087'},h2:{margin:'5px 0 15px',fontSize:30},badge:{float:'right',fontSize:12,padding:'7px 10px',borderRadius:20,background:'#e6f1eb',color:'#14523e'},search:{width:'100%',height:44,boxSizing:'border-box',padding:'0 13px',border:'1px solid #dce5df',borderRadius:12,outline:0,fontSize:14},friendList:{padding:8,overflowY:'auto'},friend:{width:'100%',display:'flex',alignItems:'center',gap:12,padding:12,border:0,borderRadius:14,background:'transparent',textAlign:'left',cursor:'pointer',color:'#17352b'},active:{background:'#eaf3ee'},avatar:{width:44,height:44,flex:'0 0 44px',borderRadius:'50%',objectFit:'cover',display:'grid',placeItems:'center',background:'#d9e9e0',color:'#18543f',fontWeight:800},empty:{padding:25,textAlign:'center',color:'#809087'},chat:{display:'flex',flexDirection:'column',minWidth:0},placeholder:{flex:1,display:'grid',placeItems:'center',alignContent:'center',textAlign:'center',color:'#718279',gap:8},icon:{width:60,height:60,borderRadius:'50%',display:'grid',placeItems:'center',background:'#e7f1eb',color:'#17543f'},header:{height:76,display:'flex',alignItems:'center',gap:12,padding:'0 20px',borderBottom:'1px solid #e1e8e3'},messages:{flex:1,overflowY:'auto',padding:24},row:{display:'flex',marginBottom:9},bubble:{maxWidth:'70%',padding:'10px 13px 7px',borderRadius:16,fontSize:15},mine:{background:'#14523e',color:'#fff',borderBottomRightRadius:5},theirs:{background:'#edf2ee',color:'#17352b',borderBottomLeftRadius:5},time:{display:'block',textAlign:'right',fontSize:10,opacity:.65,marginTop:3},start:{margin:'auto',textAlign:'center',color:'#809087'},composer:{display:'flex',gap:10,padding:14,borderTop:'1px solid #e1e8e3'},input:{flex:1,height:46,padding:'0 14px',border:'1px solid #dce5df',borderRadius:13,outline:0},send:{width:46,height:46,border:0,borderRadius:13,background:'#14523e',color:'#fff',display:'grid',placeItems:'center',cursor:'pointer'}
}
