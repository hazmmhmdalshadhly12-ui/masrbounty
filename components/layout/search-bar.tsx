'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps extends Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  placeholder?: string;
  defaultValue?: string;
  onSearch?: (query: string) => void;
}

function SearchBar({ placeholder = 'Search programs, reports…', defaultValue = '', onSearch, className, ...props }: SearchBarProps) {
  const [query, setQuery] = React.useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query.trim());
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn('flex w-full max-w-sm items-center gap-2', className)}
      {...props}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="ps-9 text-start placeholder:text-muted-foreground"
          dir="auto"
          aria-label={placeholder}
        />
      </div>
      <Button type="submit" size="sm" aria-label={placeholder}>
        Search
      </Button>
    </form>
  );
}

export { SearchBar };
export type { SearchBarProps };
