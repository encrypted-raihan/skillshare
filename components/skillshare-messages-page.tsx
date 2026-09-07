'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, FileText, LoaderCircle, Paperclip, Search, Send, UserRound } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = { id: string; full_name: string; bio: string | null; avatar_url: string | null }
type FriendRequest = { id: string; sender_id: string; receiver_id: string; created_at: string }
type Conversation = { id: string; user_a: string; user_b: string; created_at: string; updated_at: string; other: Person }
type Message = { id: string; conversation_id: string; sender_id: string; body: string; message_type: 'text'|'image'|'document'|'audio'; media_path: string|null; media_name: string|null; media_size: number|null; mime_type: string|null; duration_ms: number|null; delivered_at: string|null; read_at: string|null; deleted_at: string|null; created_at: string; media_url?: string }

const SELECT = 'id,conversation_id,sender_id,body,message_type,media_path,media_name,media_size,mime_type,duration_ms,delivered_at,read_at,deleted_at,created_at'
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]?.toUpperCase()).join('') || 'S'
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })
const bytes = (value: number|null) => !value ? '' : value < 1024 ? `${value} B` : value < 1048576 ? `${Math.round(value/1024)} KB` : `${(value/1048576).toFixed(1)} MB`

export function SkillSwapMessagesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId,setUserId] = useState('')
  const [friends,setFriends] = useState<Person[]>([])
  const [conversations,setConversations] = useState<Conversation[]>([])
  const [selectedFriendId,setSelectedFriendId] = useState('')
  const [messages,setMessages] = useState<Message[]>([])
  const [text,setText] = useState('')
  const [search,setSearch] = useState('')
  const [loading,setLoading] = useState(true)
  const [chatLoading,setChatLoading] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [mobileList,setMobileList] = useState(true)
  const [fileInput,setFileInput] = useState<HTMLInputElement|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedFriend = friends.find(f => f.id === selectedFriendId)
  const activeConversation = conversations.find(c => (c.user_a === userId ? c.user_b : c.user_a) === selectedFriendId)
  const filteredFriends = friends.filter(f => !search || f.full_name.toLowerCase().includes(search.toLowerCase()))

  async function mediaUrl(path:string|null) {
    if (!path) return ''
    const { data } = await supabase.storage.from('message-media').createSignedUrl(path,3600)
    return data?.signedUrl || ''
  }

  async function hydrate(rows:Message[]) {
    return Promise.all(rows.map(async row => ({ ...row, media_url: await mediaUrl(row.media_path) })))
  }

  async function loadFriends() {
    setLoading(true); setError('')
    const { data:auth, error:authError } = await supabase.auth.getUser()
    if (authError || !auth.user) { window.location.replace('/auth/login?next=/messages'); return }
    const id = auth.user.id; setUserId(id)

    const { data:requests, error:requestError } = await supabase.from('swap_requests')
      .select('id,sender_id,receiver_id,created_at')
      .eq('status','ACCEPTED')
      .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
      .order('created_at',{ascending:false})
    if (requestError) { setError(requestError.message); setLoading(false); return }

    const rows = (requests || []) as FriendRequest[]
    const ids = [...new Set(rows.map(r => r.sender_id === id ? r.receiver_id : r.sender_id))]
    if (!ids.length) { setFriends([]); setConversations([]); setLoading(false); return }

    const { data:profiles, error:profileError } = await supabase.from('profiles')
      .select('id,full_name,bio,avatar_url').in('id',ids)
    if (profileError) { setError(profileError.message); setLoading(false); return }

    const byId = new Map((profiles || []).map(p => [p.id,p as Person]))
    setFriends(ids.map(id => byId.get(id)).filter((p): p is Person => Boolean(p)))
    setLoading(false)

    // Conversation lookup is deliberately secondary. A broken/empty
    // conversations table must never block the Friends list from rendering.
    const { data:conversationRows } = await supabase.from('conversations')
      .select('id,user_a,user_b,created_at,updated_at')
      .or(`user_a.eq.${id},user_b.eq.${id}`)
      .order('updated_at',{ascending:false})
    const convoRows = (conversationRows || []) as Omit<Conversation,'other'>[]
    setConversations(convoRows.map(c => ({ ...c, other: byId.get(c.user_a === id ? c.user_b : c.user_a)! })).filter(c => Boolean(c.other)))
  }

  async function ensureConversation(friendId:string) {
    const existing = conversations.find(c => (c.user_a === userId ? c.user_b : c.user_a) === friendId)
    if (existing) return existing.id

    setChatLoading(true); setError('')
    try {
      const rpc = supabase.rpc('ensure_conversation',{p_user_a:userId,p_user_b:friendId})
      const timeout = new Promise<never>((_,reject) => setTimeout(() => reject(new Error('Creating the conversation timed out.')),7000))
      const { data,error } = await Promise.race([rpc,timeout])
      if (error) throw error
      if (!data) throw new Error('Conversation could not be created.')
      const friend = friends.find(f => f.id === friendId)
      if (friend) setConversations(prev => [...prev.filter(c => c.id !== data),{ id:data as string,user_a:userId,user_b:friendId,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),other:friend }])
      return data as string
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be created.')
      return ''
    } finally { setChatLoading(false) }
  }

  async function openFriend(friendId:string) {
    setSelectedFriendId(friendId); setMobileList(false); setMessages([]); setError('')
    const conversationId = await ensureConversation(friendId)
    if (conversationId) await loadMessages(conversationId)
  }

  async function loadMessages(conversationId:string) {
    const { data,error:queryError } = await supabase.from('messages').select(SELECT).eq('conversation_id',conversationId).order('created_at',{ascending:true})
    if (queryError) { setError(queryError.message); return }
    setMessages(await hydrate((data || []) as Message[]))
    void supabase.rpc('mark_conversation_read',{conversation_id:conversationId})
  }

  useEffect(() => { void loadFriends() },[supabase])

  useEffect(() => {
    if (!activeConversation) return
    const channel = supabase.channel(`messages:${activeConversation.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${activeConversation.id}`},async payload => {
        const row = payload.new as Message
        const hydrated = { ...row,media_url:await mediaUrl(row.media_path) }
        setMessages(prev => prev.some(m => m.id === hydrated.id) ? prev : [...prev,hydrated])
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? {...c,updated_at:hydrated.created_at} : c))
        if (hydrated.sender_id !== userId) void supabase.rpc('mark_conversation_read',{conversation_id:activeConversation.id})
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:`conversation_id=eq.${activeConversation.id}`},payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? {...m, ...(payload.new as Message)} : m))
      }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  },[activeConversation?.id,userId,supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages.length,activeConversation?.id])

  async function send() {
    const body=text.trim(); if (!body || !selectedFriendId || busy) return
    setBusy(true); setError('')
    const conversationId = activeConversation?.id || await ensureConversation(selectedFriendId)
    if (!conversationId) { setBusy(false); return }
    const { data,error } = await supabase.from('messages').insert({conversation_id:conversationId,sender_id:userId,body,message_type:'text',delivered_at:new Date().toISOString()}).select(SELECT).single()
    if (error) setError(error.message)
    else if (data) { const hydrated=(await hydrate([data as Message]))[0]; setMessages(prev => prev.some(m=>m.id===hydrated.id)?prev:[...prev,hydrated]); setConversations(prev=>prev.map(c=>c.id===conversationId?{...c,updated_at:hydrated.created_at}:c)); setText('') }
    setBusy(false)
  }

  async function upload(file:File) {
    if (!file || !selectedFriendId || busy) return
    setBusy(true); setError('')
    try {
      const conversationId=activeConversation?.id || await ensureConversation(selectedFriendId)
      if (!conversationId) return
      const type=file.type.startsWith('image/')?'image':'document'
      const ext=file.name.split('.').pop() || 'bin'
      const path=`${userId}/${conversationId}/${crypto.randomUUID()}.${ext}`
      const uploadResult=await supabase.storage.from('message-media').upload(path,file,{contentType:file.type || undefined})
      if (uploadResult.error) throw uploadResult.error
      const { data,error }=await supabase.from('messages').insert({conversation_id:conversationId,sender_id:userId,body:'',message_type:type,media_path:path,media_name:file.name,media_size:file.size,mime_type:file.type,delivered_at:new Date().toISOString()}).select(SELECT).single()
      if (error) { await supabase.storage.from('message-media').remove([path]); throw error }
      if (data) setMessages(prev => [...prev,(await hydrate([data as Message]))[0]])
    } catch(cause) { setError(cause instanceof Error?cause.message:'Attachment failed.') }
    finally { setBusy(false); if(fileInput) fileInput.value='' }
  }

  const renderBody=(m:Message) => {
    if (m.deleted_at) return <i className="wa-deleted">This message was deleted</i>
    if (m.message_type==='image') return m.media_url ? <img className="wa-message-image" src={m.media_url} alt={m.media_name || 'Image'} /> : <span>Loading image…</span>
    if (m.message_type==='document') return <a className="wa-document" href={m.media_url || '#'} target="_blank" rel="noreferrer"><span className="wa-document-icon"><FileText size={18}/></span><span><b>{m.media_name || 'Document'}</b><small>{bytes(m.media_size)} · Open document</small></span></a>
    if (m.message_type==='audio') return <audio controls src={m.media_url || ''}/>
    return <span className="wa-text">{m.body}</span>
  }

  return <div className="wa-page"><AppSidebar/><main className="wa-main">
    <div className="wa-heading"><p>YOUR CONNECTIONS</p><h1>Chats</h1><span>Chat with your SkillSwap friends after you accept a swap request.</span></div>
    {error && <div className="wa-error">{error}</div>}
    <section className="wa-card">
      <aside className={`wa-list ${mobileList?'':'wa-list-mobile-hidden'}`}>
        <div className="wa-list-head"><div className="wa-list-title"><div><p>YOUR FRIENDS</p><h2>Chats</h2></div><b>{friends.length}</b></div><label><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search friends"/></label></div>
        <div className="wa-list-body">
          {loading ? <div className="wa-empty"><LoaderCircle className="wa-spin" size={24}/><span>Loading your friends…</span></div> : filteredFriends.length===0 ? <div className="wa-empty"><UserRound size={34}/><strong>No friends to message yet.</strong><a href="/explore">Find someone to swap skills with.</a></div> : filteredFriends.map(friend => {
            const convo=conversations.find(c => (c.user_a===userId?c.user_b:c.user_a)===friend.id)
            return <button key={friend.id} className={`wa-convo ${selectedFriendId===friend.id?'active':''}`} onClick={()=>void openFriend(friend.id)}>
              <span className="wa-avatar">{friend.avatar_url?<img src={friend.avatar_url} alt=""/>:initials(friend.full_name)}</span>
              <span className="wa-convo-copy"><b>{friend.full_name}</b><small>SkillSwap friend</small></span>
              {convo ? <time>{time(convo.updated_at || convo.created_at)}</time> : <span className="wa-new-chat">Chat</span>}
            </button>
          })}
        </div>
      </aside>
      <section className={`wa-chat ${mobileList?'wa-chat-mobile-hidden':''}`}>
        {selectedFriend ? <>
          <header className="wa-chat-head"><button className="wa-back" onClick={()=>setMobileList(true)}><ChevronLeft size={20}/></button><button className="wa-person" onClick={()=>window.location.assign(`/people/${selectedFriend.id}`)}><span className="wa-avatar">{selectedFriend.avatar_url?<img src={selectedFriend.avatar_url} alt=""/>:initials(selectedFriend.full_name)}</span><span><b>{selectedFriend.full_name}</b><small>SkillSwap friend</small></span></button><button className="wa-profile" onClick={()=>window.location.assign(`/people/${selectedFriend.id}`)}><UserRound size={18}/></button></header>
          <div className="wa-messages"><div className="wa-encrypted">MESSAGES ARE ENCRYPTED BETWEEN YOU</div>{chatLoading ? <div className="wa-start"><LoaderCircle className="wa-spin" size={26}/><h2>Opening chat…</h2><p>Connecting you with your friend.</p></div> : messages.length===0 ? <div className="wa-start"><div>✦</div><h2>Start the conversation</h2><p>You are connected. Say hello and start your skill swap.</p></div> : <div className="wa-message-stack">{messages.map(m => { const mine=m.sender_id===userId; return <div key={m.id} className={`wa-row ${mine?'mine':''}`}><div className={`wa-bubble ${mine?'mine':''}`}>{renderBody(m)}<footer><span>{time(m.created_at)}</span>{mine && <span className={m.read_at?'wa-read':''}><Check size={11}/><Check size={11}/></span>}</footer></div></div>})}<div ref={bottomRef}/></div>}</div>
          <div className="wa-composer"><input ref={el=>setFileInput(el)} type="file" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f)}}/><button type="button" className="wa-attach" disabled={busy||chatLoading} onClick={()=>fileInput?.click()}><Paperclip size={19}/></button><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="Type a message…" disabled={busy||chatLoading}/><button type="button" className="wa-send" disabled={busy||chatLoading||!text.trim()} onClick={()=>void send()}><Send size={18}/></button></div>
        </> : <div className="wa-select-empty"><UserRound size={34}/><p>Select a friend to start chatting.</p></div>}
      </section>
    </section>
  </main></div>
}
