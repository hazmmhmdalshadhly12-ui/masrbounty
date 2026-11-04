'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Plus, Pencil, Trash2, Eye, EyeOff, Sparkles, FileUp, CheckCircle2, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpload } from '@/hooks/use-upload';
import {
  createCourseAction, updateCourseAction, setCoursePublishedAction, deleteCourseAction,
  createLessonAction, updateLessonAction, deleteLessonAction, generateLessonAiAction, markLessonReviewedAction,
} from '@/features/academy/admin-actions';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

export type AdminCourse = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  level: string;
  category: string;
  is_published: boolean;
  is_free: boolean;
  price: number | null;
  sort_order: number;
};

export type AdminLesson = {
  id: string;
  course_id: string;
  title_ar: string;
  objectives: string[];
  content_ar: string;
  video_url: string;
  attachment_path: string;
  duration_minutes: number;
  sort_order: number;
  is_published: boolean;
  generated_by_ai: boolean;
  ai_reviewed: boolean;
  quiz_pass_score: number;
  quizJson: string;
};

const EMPTY_COURSE = {
  title_ar: '', title_en: '', slug: '', description_ar: '', description_en: '',
  level: 'beginner', category: 'general', is_free: true, price: '', sort_order: '0',
};

export function AcademyManager({ courses, lessons }: { courses: AdminCourse[]; lessons: AdminLesson[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = React.useState<string | null>(null);
  const [editingCourse, setEditingCourse] = React.useState<AdminCourse | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_COURSE });

  const courseLessons = React.useMemo(
    () => lessons.filter((l) => l.course_id === selectedCourseId).sort((a, b) => a.sort_order - b.sort_order),
    [lessons, selectedCourseId]
  );
  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  function startCreate() {
    setEditingCourse(null);
    setForm({ ...EMPTY_COURSE });
    setShowCreate(true);
  }
  function startEdit(c: AdminCourse) {
    setEditingCourse(c);
    setForm({
      title_ar: c.title_ar, title_en: c.title_en ?? '', slug: c.slug,
      description_ar: c.description_ar ?? '', description_en: c.description_en ?? '',
      level: c.level, category: c.category, is_free: c.is_free,
      price: c.price != null ? String(c.price) : '', sort_order: String(c.sort_order),
    });
    setShowCreate(true);
  }

  async function saveCourse() {
    setBusy('course');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)));
    fd.set('is_free', form.is_free ? 'on' : 'off');
    const res = editingCourse ? await updateCourseAction(editingCourse.id, fd) : await createCourseAction(fd);
    if (res.ok) {
      toastSuccess(editingCourse ? 'تم تحديث الدورة' : 'تم إنشاء الدورة كمسودة');
      setShowCreate(false);
      router.refresh();
    } else toastError(res.error ?? 'فشل الحفظ');
    setBusy(null);
  }

  async function togglePublish(c: AdminCourse) {
    setBusy(`pub-${c.id}`);
    const res = await setCoursePublishedAction(c.id, !c.is_published);
    if (res.ok) toastSuccess(!c.is_published ? 'نُشرت الدورة' : 'أُخفيت الدورة');
    else toastError(res.error ?? 'فشل التغيير');
    setBusy(null);
    router.refresh();
  }

  async function removeCourse(c: AdminCourse) {
    if (!window.confirm(`حذف "${c.title_ar}"؟ سيُحذف كل دروسها وتقدم الطلاب نهائيًا.`)) return;
    setBusy(`del-${c.id}`);
    const res = await deleteCourseAction(c.id);
    if (res.ok) { toastSuccess('حُذفت الدورة'); if (selectedCourseId === c.id) setSelectedCourseId(null); }
    else toastError(res.error ?? 'فشل الحذف');
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Button type="button" onClick={startCreate} className="gap-2"><Plus className="h-4 w-4" /> دورة جديدة</Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{editingCourse ? `تعديل: ${editingCourse.title_ar}` : 'دورة جديدة (مسودة)'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>العنوان (عربي) *</Label><Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></div>
              <div><Label>العنوان (إنجليزي)</Label><Input dir="ltr" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
              <div><Label>المعرّف slug (اختياري)</Label><Input dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="web-fundamentals" /></div>
              <div>
                <Label>المستوى</Label>
                <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="mt-1 h-10 w-full rounded-md border px-3">
                  <option value="beginner">مبتدئ</option>
                  <option value="intermediate">متوسط</option>
                  <option value="advanced">متقدم</option>
                </select>
              </div>
              <div><Label>التصنيف</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="web / networks / tools" /></div>
              <div><Label>ترتيب العرض</Label><Input type="number" dir="ltr" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <div><Label>الوصف (عربي)</Label><Textarea rows={3} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} /></div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_free} onChange={(e) => setForm({ ...form, is_free: e.target.checked })} /> مجانية</label>
              {!form.is_free && (
                <div className="flex items-center gap-2"><Label>السعر (EGP)</Label><Input type="number" dir="ltr" className="w-28" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={saveCourse} disabled={busy !== null} className="gap-2">
                {busy === 'course' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} حفظ
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Courses table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">الدورات ({courses.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {courses.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">لا توجد دورات بعد.</p>}
          {courses.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${selectedCourseId === c.id ? 'border-primary' : ''}`}>
              <button type="button" className="flex flex-1 items-center gap-2 text-start" onClick={() => setSelectedCourseId(selectedCourseId === c.id ? null : c.id)}>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold">{c.title_ar}</span>
                <Badge variant="outline" className="text-[10px]">{c.level}</Badge>
                {c.is_published ? <Badge className="bg-emerald-600 text-[10px]">منشورة</Badge> : <Badge variant="secondary" className="text-[10px]">مسودة</Badge>}
              </button>
              <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(c)} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => togglePublish(c)} disabled={busy !== null} aria-label={c.is_published ? 'إخفاء' : 'نشر'}>
                {c.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeCourse(c)} disabled={busy !== null} aria-label="حذف"><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Lessons of selected course */}
      {selectedCourse && (
        <LessonsPanel course={selectedCourse} lessons={courseLessons} />
      )}
    </div>
  );
}

function LessonsPanel({ course, lessons }: { course: AdminCourse; lessons: AdminLesson[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminLesson | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [aiTopic, setAiTopic] = React.useState('');
  const [aiLevel, setAiLevel] = React.useState('beginner');
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiMsg, setAiMsg] = React.useState<string | null>(null);
  const upload = useUpload('academy-materials');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const emptyLesson = {
    title_ar: '', title_en: '', objectives_raw: '', content_ar: '', video_url: '',
    attachment_path: '', duration_minutes: '15', sort_order: String(lessons.length),
    is_published: false, quiz_pass_score: '70', quiz: '',
  };
  const [lf, setLf] = React.useState({ ...emptyLesson });

  function startNewLesson() {
    setEditing(null);
    setLf({ ...emptyLesson, sort_order: String(lessons.length) });
    setShowForm(true);
  }
  function startEditLesson(l: AdminLesson) {
    setEditing(l);
    setLf({
      title_ar: l.title_ar, title_en: '', objectives_raw: l.objectives.join('\n'),
      content_ar: l.content_ar ?? '', video_url: l.video_url ?? '', attachment_path: l.attachment_path ?? '',
      duration_minutes: String(l.duration_minutes), sort_order: String(l.sort_order),
      is_published: l.is_published, quiz_pass_score: String(l.quiz_pass_score), quiz: l.quizJson,
    });
    setShowForm(true);
  }

  async function saveLesson() {
    setBusy('lesson');
    const fd = new FormData();
    Object.entries(lf).forEach(([k, v]) => fd.set(k, String(v)));
    fd.set('is_published', lf.is_published ? 'on' : 'off');
    const res = editing ? await updateLessonAction(editing.id, fd) : await createLessonAction(course.id, fd);
    if (res.ok) { toastSuccess(editing ? 'تم تحديث الدرس' : 'أُضيف الدرس'); setShowForm(false); router.refresh(); }
    else toastError(res.error ?? 'فشل الحفظ');
    setBusy(null);
  }

  async function removeLesson(l: AdminLesson) {
    if (!window.confirm(`حذف الدرس "${l.title_ar}"؟`)) return;
    setBusy(`del-${l.id}`);
    const res = await deleteLessonAction(l.id);
    if (res.ok) toastSuccess('حُذف الدرس'); else toastError(res.error ?? 'فشل الحذف');
    setBusy(null);
    router.refresh();
  }

  async function markReviewed(l: AdminLesson) {
    setBusy(`rev-${l.id}`);
    const res = await markLessonReviewedAction(l.id);
    if (res.ok) toastSuccess('اعتُبر الدرس مُراجعًا — يمكن نشره الآن'); else toastError(res.error ?? 'فشل');
    setBusy(null);
    router.refresh();
  }

  async function generateAi() {
    setAiBusy(true);
    setAiMsg(null);
    const res = await generateLessonAiAction(course.id, aiTopic, aiLevel as 'beginner' | 'intermediate' | 'advanced');
    if (res.ok) { setAiMsg('تم توليد الدرس وحفظه كمسودة (غير منشورة) — راجعه وعدّله ثم علّمه «مُراجعًا» وانشره.'); router.refresh(); }
    else setAiMsg(res.error ?? 'فشل التوليد');
    setAiBusy(false);
  }

  async function onUploadFile(file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const res = await upload.mutateAsync({ file, path: `${course.id}/${Date.now()}-${safeName}` });
    setLf((f) => ({ ...f, attachment_path: res.path }));
    toastSuccess('تم رفع الملف إلى حاوية الدورة');
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">دروس: {course.title_ar} ({lessons.length})</CardTitle>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={startNewLesson}><Plus className="h-3.5 w-3.5" /> درس جديد</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* AI generator */}
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> توليد درس بالذكاء الاصطناعي (يُحفظ كمسودة للمراجعة)</p>
          <div className="flex flex-wrap gap-2">
            <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="موضوع الدرس… مثال: فهم XSS من خلال أمثلة آمنة" className="min-w-[240px] flex-1" />
            <select value={aiLevel} onChange={(e) => setAiLevel(e.target.value)} className="h-9 rounded-md border px-2 text-sm" aria-label="مستوى الدرس">
              <option value="beginner">مبتدئ</option>
              <option value="intermediate">متوسط</option>
              <option value="advanced">متقدم</option>
            </select>
            <Button type="button" size="sm" onClick={generateAi} disabled={aiBusy || aiTopic.trim().length < 3} className="gap-1">
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} توليد
            </Button>
          </div>
          {aiMsg && <p className="mt-2 rounded bg-muted p-2 text-xs leading-relaxed">{aiMsg}</p>}
        </div>

        {/* Lessons list */}
        {lessons.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">لا دروس بعد — أضف درسًا أو ولّد درسًا بالذكاء الاصطناعي.</p>
        ) : (
          lessons.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-[11px] font-black">{l.sort_order}</span>
              <span className="flex-1 text-sm font-bold">{l.title_ar}</span>
              {l.generated_by_ai && (
                l.ai_reviewed
                  ? <Badge variant="outline" className="gap-1 text-[10px] text-emerald-700 border-emerald-300"><CheckCircle2 className="h-3 w-3" /> AI مُراجع</Badge>
                  : <Badge variant="secondary" className="gap-1 text-[10px] bg-amber-100 text-amber-800"><Sparkles className="h-3 w-3" /> AI بحاجة مراجعة</Badge>
              )}
              {l.is_published ? <Badge className="bg-emerald-600 text-[10px]">منشور</Badge> : <Badge variant="secondary" className="text-[10px]">مسودة</Badge>}
              {!l.ai_reviewed && l.generated_by_ai && (
                <Button type="button" size="sm" variant="outline" className="gap-1 text-xs" onClick={() => markReviewed(l)} disabled={busy !== null}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> اعتبره مُراجعًا
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => startEditLesson(l)} aria-label="تعديل الدرس"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeLesson(l)} disabled={busy !== null} aria-label="حذف الدرس"><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
            </div>
          ))
        )}

        {/* Lesson form */}
        {showForm && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-black">{editing ? `تعديل الدرس: ${editing.title_ar}` : 'درس جديد'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>العنوان (عربي) *</Label><Input value={lf.title_ar} onChange={(e) => setLf({ ...lf, title_ar: e.target.value })} /></div>
              <div><Label>العنوان (إنجليزي)</Label><Input dir="ltr" value={lf.title_en} onChange={(e) => setLf({ ...lf, title_en: e.target.value })} /></div>
              <div><Label>المدة (دقائق)</Label><Input type="number" dir="ltr" value={lf.duration_minutes} onChange={(e) => setLf({ ...lf, duration_minutes: e.target.value })} /></div>
              <div><Label>الترتيب</Label><Input type="number" dir="ltr" value={lf.sort_order} onChange={(e) => setLf({ ...lf, sort_order: e.target.value })} /></div>
            </div>
            <div><Label>أهداف التعلم (هدف في كل سطر)</Label><Textarea rows={3} value={lf.objectives_raw} onChange={(e) => setLf({ ...lf, objectives_raw: e.target.value })} /></div>
            <div><Label>محتوى الدرس (عربي)</Label><Textarea rows={10} value={lf.content_ar} onChange={(e) => setLf({ ...lf, content_ar: e.target.value })} className="font-mono text-xs" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>رابط الفيديو (YouTube)</Label><Input dir="ltr" value={lf.video_url} onChange={(e) => setLf({ ...lf, video_url: e.target.value })} /></div>
              <div>
                <Label>ملف PDF تعليمي (حاوية خاصة)</Label>
                <div className="flex items-center gap-2">
                  <Input dir="ltr" readOnly value={lf.attachment_path} placeholder="academy-materials/<course>/…" className="text-xs" />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= 10 * 1024 * 1024) void onUploadFile(f); }}
                  />
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                    {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />} رفع
                  </Button>
                </div>
              </div>
            </div>
            <div><Label>{'الاختبار (JSON: [{q, options[], correct, explanation}] — يُصحح على الخادم)'}</Label>
              <Textarea rows={6} dir="ltr" value={lf.quiz} onChange={(e) => setLf({ ...lf, quiz: e.target.value })} className="font-mono text-xs" placeholder='[{"q":"ما هو XSS؟","options":["...","..."],"correct":0,"explanation":"..."}]' />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lf.is_published} onChange={(e) => setLf({ ...lf, is_published: e.target.checked })} /> منشور</label>
              <div className="flex items-center gap-2"><Label className="shrink-0">حد النجاح %</Label><Input type="number" dir="ltr" className="w-20" value={lf.quiz_pass_score} onChange={(e) => setLf({ ...lf, quiz_pass_score: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={saveLesson} disabled={busy !== null} className="gap-2">
                {busy === 'lesson' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} حفظ الدرس
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
