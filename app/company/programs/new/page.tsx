import { createProgramAction } from '@/features/programs/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewProgram() {
  return (
    <main className="container py-8 max-w-2xl">
      <Card><CardHeader><CardTitle>برنامج جديد</CardTitle></CardHeader><CardContent>
        <form action={createProgramAction} className="space-y-4">
          <div><Label>Name</Label><Input name="name" required minLength={3} /></div>
          <div><Label>Slug</Label><Input name="slug" required minLength={3} dir="ltr" placeholder="my-program" /></div>
          <div><Label>Description</Label><Textarea name="description" required /></div>
          <div><Label>Visibility</Label><select name="visibility" className="h-10 border rounded-md px-3 w-full"><option value="public">Public</option><option value="private">Private</option></select></div>
          <div><Label>Scope</Label><Textarea name="scope" required placeholder="*.example.com, api.example.com…" dir="ltr" /></div>
          <div><Label>Contact email</Label><Input name="contact_email" type="email" required dir="ltr" /></div>
          <Button type="submit" className="w-full">Create draft</Button>
        </form>
      </CardContent></Card>
    </main>
  );
}
