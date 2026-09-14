'use client';

import type { Conversation, Message } from './types';

export function MessagingView({ conversations }: { conversations: Conversation[] }) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">No conversations</p>
        <p className="text-sm text-muted-foreground">Start a conversation to coordinate.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {conversations.map((c) => (
        <li key={c.id} className="p-3">
          <p className="font-medium">{c.subject ?? 'Conversation'}</p>
          <p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}

export function MessageList({ messages, currentUserId }: { messages: Message[]; currentUserId: string }) {
  if (messages.length === 0) return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  return (
    <ul className="space-y-2">
      {messages.map((m) => {
        const mine = m.sender_id === currentUserId;
        return (
          <li key={m.id} className={`max-w-[80%] rounded-lg border p-2 text-sm ${mine ? 'ml-auto bg-muted' : ''}`}>
            <p>{m.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
          </li>
        );
      })}
    </ul>
  );
}
