'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PermissionPicker, type PermissionOption } from '@/components/teams/permission-picker';
import { Shield, UserMinus, AlertTriangle, X } from 'lucide-react';

export interface EditableMember {
  id: string;
  user_id: string;
  role: string;
  username: string;
  fullName: string;
  /** permissions already granted beyond role defaults */
  granted: string[];
  revoked: string[];
  self: boolean;
  isOwnerRow: boolean;
}

/**
 * Edit panel (role + granular permissions) and destructive remove flow with
 * typed-name confirmation — inline expandable panels (no modal dependency).
 * The form posts to server actions which re-run every authorization check;
 * this UI never decides anything security-related.
 */
export function MemberActionsDialog({
  member,
  mode,
  roleOptions,
  permissionOptions,
  canManage,
  formAction,
  removeAction,
  back,
  extraFields,
}: {
  member: EditableMember;
  mode: 'company' | 'team';
  roleOptions: { value: string; label: string }[];
  permissionOptions: PermissionOption[];
  canManage: boolean;
  formAction: (fd: FormData) => Promise<void>;
  removeAction?: (fd: FormData) => Promise<void>;
  back: string;
  extraFields?: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const hidden = (k: string, v: string) => <input key={k} type="hidden" name={k} value={v} />;

  if (!canManage || member.isOwnerRow || member.self) return null;

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2">
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" type="button" onClick={() => { setEditing((v) => !v); setRemoving(false); }} className="h-8 gap-1 text-xs">
          <Shield className="h-3.5 w-3.5" /> {editing ? 'إغلاق' : 'تعديل'}
        </Button>
        {removeAction && (
          <Button variant="outline" size="sm" type="button" onClick={() => { setRemoving((v) => !v); setEditing(false); }} className="h-8 gap-1 border-red-200 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400">
            <UserMinus className="h-3.5 w-3.5" /> {removing ? 'إلغاء' : 'إزالة'}
          </Button>
        )}
      </div>

      {editing && (
        <form action={formAction} className="w-full space-y-3 rounded-lg border bg-muted/20 p-3">
          {Object.entries(extraFields ?? {}).map(([k, v]) => hidden(k, v))}
          {hidden('back', back)}
          {hidden('member_id', member.id)}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">تعديل عضوية {member.fullName || member.username}</p>
            <button type="button" aria-label="إغلاق" onClick={() => setEditing(false)} className="rounded p-1 hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`role-${member.id}`}>الدور</label>
            <select
              id={`role-${member.id}`}
              name="role"
              defaultValue={member.role}
              className="h-9 w-full rounded-md border bg-card px-2 text-sm dark:border-slate-700"
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">صلاحيات إضافية (grant)</p>
            <PermissionPicker options={permissionOptions} name="grant" initialSelected={member.granted} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">صلاحيات مسحوبة من الدور (revoke)</p>
            <PermissionPicker options={permissionOptions} name="revoke" initialSelected={member.revoked} />
          </div>
          <Button type="submit" size="sm" className="w-full">حفظ التغييرات</Button>
        </form>
      )}

      {removing && removeAction && (
        <form
          action={async (fd) => {
            await removeAction(fd);
            setRemoving(false);
          }}
          className="w-full space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30"
        >
          {Object.entries(extraFields ?? {}).map(([k, v]) => hidden(k, v))}
          {hidden('back', back)}
          {hidden('member_id', member.id)}
          <p className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> سيخسر {member.fullName || member.username} فورًا كل وصوله إلى {mode === 'company' ? 'بيانات الشركة' : 'بيانات الفريق'}
          </p>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={`اكتب الاسم بالكامل: ${member.fullName || member.username}`}
            className="h-9 w-full rounded-md border bg-card px-3 text-sm dark:border-slate-700"
          />
          <Button
            type="submit"
            disabled={confirmName.trim() !== (member.fullName || member.username).trim()}
            className="w-full bg-red-600 text-white hover:bg-red-700"
            size="sm"
          >
            تأكيد الإزالة
          </Button>
        </form>
      )}
    </div>
  );
}
