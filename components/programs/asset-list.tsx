import * as React from 'react';
import { Globe, Link2, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgramAsset {
  id: string;
  type: string;
  value: string;
}

interface AssetListProps extends React.HTMLAttributes<HTMLDivElement> {
  assets?: ProgramAsset[];
  title?: string;
}

const typeIcons: Record<string, typeof Globe> = {
  url: Globe,
  domain: Globe,
  api: Server,
  endpoint: Link2,
};

function AssetList({ assets = [], title = 'In-scope assets', className, ...props }: AssetListProps) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assets listed for this program.</p>
      ) : (
        <ul className="space-y-2">
          {assets.map((asset) => {
            const Icon = typeIcons[asset.type.toLowerCase()] ?? Server;
            return (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{asset.value}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase text-secondary-foreground">
                  {asset.type}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { AssetList };
export type { AssetListProps };
