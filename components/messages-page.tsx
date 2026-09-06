'use client'

import { LoaderCircle, MessageCircle, Send, UsersRound } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Conversation = { id: string; user_a: string; user_b: string; created_at: string; other?: Person }
type Person = { id: string; full_name: string; bio: string | null; avatar_url: string | null }
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
function initials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map((p)=>p[0]?.toUpperCase()).join('')||'S' }

export function MessagesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId,setUserId]=useState(''); const [conversations,setConversations]=useState<Conversation[]>([]); const [selected,setSelected]=useState<string>(''); const [messages,setMessages]=useState<Message[]>([]); const [people,setPeople]=useState<Record<string,Person>>({}); const [text,setText]=useState(''); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState('')

  async function loadConversations() {
    const { data: auth } = await supabase.auth.getUser(); if (!auth.user) { window.location.assign('/auth/login?next=/messages'); return }
    const id=auth.user.id; setUserId(id)
    const { data, error: convError } = await supabase.from('conversations').select('id, user_a, user_b, created_at').or(`user_a.eq.${id},user_b.eq.${id}`).order('created_at',{ascending:false})
    if (convError) { setError(convError.message); setLoading(false); return }
    const convs=(data??[]) as Conversation[]; const ids=[...new Set(convs.map(c=>c.user_a===id?c.user_b:c.user_a))]
    if(ids.length){ const {data:p}=await supabase.from('profiles').select('id, full_name, bio, avatar_url').in('id',ids); const map:Record<string,Person>={}; (p??[]).forEach(x=>map[x.id]=x as Person); setPeople(map); setConversations(convs.map(c=>({...c,other:map[c.user_a===id?c.user_b:c.user_a]}))) } else { setPeople({}); setConversations(convs) }
    setLoading(false); if(!selected && convs[0]) setSelected(convs[0].id); if(selected && !convs.some(c=>c.id===selected)) setSelected(convs[0]?.id ?? '')
  }
  async function loadMessages(conversationId:string){ const {data,error:msgError}=await supabase.from('messages').select('id, conversation_id, sender_id, body, created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true}); if(msgError){setError(msgError.message);return};setMessages((data??[]) as Message[]) }
  useEffect(()=>{loadConversations()},[supabase])
  useEffect(()=>{ if(selected) loadMessages(selected) },[selected,supabase])
  useEffect(()=>{ if(!selected) return; const channel=supabase.channel(`conversation:${selected}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${selected}`},payload=>{setMessages(prev=>prev.some(m=>m.id===payload.new.id)?prev:[...prev,payload.new as Message])}).subscribe(); return ()=>{supabase.removeChannel(channel)} },[supabase,selected])

  async function sendMessage(e:FormEvent){ e.preventDefault(); const body=text.trim(); if(!body||!selected||busy) return; setBusy(true);setError(''); const {data,error:sendError}=await supabase.from('messages').insert({conversation_id:selected,sender_id:userId,body}).select('id, conversation_id, sender_id, body, created_at').single(); if(sendError)setError(sendError.message);else{setMessages(prev=>[...prev,data as Message]);setText('')}setBusy(false) }
  const active=conversations.find(c=>c.id===selected); const other=active?.other
  return <div className="app-page-shell"><AppSidebar/><main className="v1-content"><div className="v1-top"><div><p className="section-kicker">YOUR CONNECTIONS</p><h1>Messages</h1><p>Chat with people whose swap requests you accepted.</p></div></div><section className="v1-card message-layout">{loading?<div className="v1-empty" style={{gridColumn:'1 / -1'}}><div><LoaderCircle className="spin" size={23}/><p>Loading conversations…</p></div></div>:<><div className="thread-list">{conversations.length===0?<div className="v1-empty" style={{minHeight:220}}><div><UsersRound size={22}/><p>No conversations yet.</p><a href="/requests" className="text-link">Check your requests</a></div></div>:conversations.map(c=><button key={c.id} className={`thread-button ${selected===c.id?'active':''}`} onClick={()=>setSelected(c.id)}><span className="v1-avatar">{c.other?.avatar_url?<img src={c.other.avatar_url} alt=""/>:initials(c.other?.full_name??'SS')}</span><span><strong>{c.other?.full_name??'SkillSwap member'}</strong><small>{c.other?.bio||'SkillSwap connection'}</small></span></button>)}</div><div className="chat-panel">{other?<><header className="chat-header"><span className="v1-avatar">{other.avatar_url?<img src={other.avatar_url} alt=""/>:initials(other.full_name)}</span><div><strong>{other.full_name}</strong><div className="small-muted">SkillSwap connection</div></div></header><div className="chat-messages">{messages.length===0?<div className="v1-empty" style={{minHeight:200}}><div><MessageCircle size={22}/><p>Say hello and decide what you want to swap.</p></div></div>:messages.map(m=><div key={m.id} className={`chat-bubble ${m.sender_id===userId?'mine':''}`}>{m.body}<div style={{opacity:.6,fontSize:8,marginTop:4}}>{new Date(m.created_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</div></div>)}</div><form className="chat-compose" onSubmit={sendMessage}><input value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message…" maxLength={1000} /><button type="submit" disabled={busy||!text.trim()} aria-label="Send message"><Send size={15}/></button></form></>:<div className="v1-empty"><div><MessageCircle size={25}/><p>Select a conversation to start chatting.</p></div></div>}</div></>}</section>{error&&<div className="explore-alert error" style={{marginTop:12}}>{error}</div>}</main></div>
}
