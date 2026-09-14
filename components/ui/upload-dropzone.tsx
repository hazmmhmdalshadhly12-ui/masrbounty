'use client';

import * as React from 'react';
import { FileUp, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface UploadDropzoneProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  onError?: (message: string) => void;
}

function UploadDropzone({
  accept,
  maxFiles = 5,
  maxSizeMB = 10,
  multiple = true,
  disabled = false,
  onFiles,
  onError,
  className,
  children,
  ...props
}: UploadDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragging, setDragging] = React.useState(false);

  const handleFiles = React.useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (files.length + list.length > maxFiles) {
        onError?.(`Maximum ${maxFiles} files allowed.`);
        return;
      }
      const oversized = list.find((f) => f.size > maxSizeMB * 1024 * 1024);
      if (oversized) {
        onError?.(`"${oversized.name}" exceeds ${maxSizeMB}MB.`);
        return;
      }
      const next = [...files, ...list];
      setFiles(next);
      onFiles?.(next);
    },
    [files, maxFiles, maxSizeMB, onFiles, onError],
  );

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFiles?.(next);
  };

  return (
    <div className={cn('space-y-3', className)} {...props}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-6 py-10 text-center transition-colors',
          dragging ? 'border-primary bg-accent' : 'hover:bg-accent/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        {children ?? (
          <>
            <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Up to {maxFiles} files, {maxSizeMB}MB each
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
            >
              <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { UploadDropzone };
