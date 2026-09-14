'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSend?: (body: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  conversationId?: string;
}

export function ChatInput({
  onSend,
  placeholder = 'اكتب رسالة…',
  disabled,
  title,
  conversationId,
}: ChatInputProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending || !onSend) return;
    setSending(true);
    try {
      await onSend(text);
      setBody('');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2" aria-label={title ?? 'إرسال رسالة'}>
      {conversationId && <input type="hidden" name="conversation_id" value={conversationId} />}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || sending}
        rows={3}
        aria-label="نص الرسالة"
      />
      <Button type="submit" size="sm" disabled={disabled || sending || !body.trim()}>
        <Send className="h-3.5 w-3.5" />
        {sending ? 'جارٍ الإرسال…' : 'إرسال'}
      </Button>
    </form>
  );
}
