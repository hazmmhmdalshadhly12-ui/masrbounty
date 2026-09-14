'use client';

import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// رفع الملفات إلى Supabase Storage (avatars / report-attachments)
export interface UploadInput {
  file: File;
  path?: string;
}

export interface UploadResult {
  path: string;
}

export function useUpload(bucket = 'report-attachments') {
  return useMutation({
    mutationKey: ['upload', bucket],
    mutationFn: async ({ file, path }: UploadInput): Promise<UploadResult> => {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const target = path ?? `${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage.from(bucket).upload(target, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      return { path: data.path };
    },
  });
}
