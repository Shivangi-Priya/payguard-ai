import type { ReactNode } from 'react'
import type { RiskTier } from '../lib/format'

export interface ChainNode {
  key: string
  label: string
  detail?: ReactNode
  tier?: RiskTier | 'neutral'
  broken?: boolean
}

const tierBorder: Record<string, string> = {
  safe: 'border-safe/50 bg-safe-soft',
  medium: 'border-medium/50 bg-medium-soft',
  high: 'border-high/50 bg-high-soft',
  critical: 'border-critical/60 bg-critical-soft',
  neutral: 'border-border bg-surface-2',
}

const tierDotColor: Record<string, string> = {
  safe: 'bg-safe',
  medium: 'bg-medium',
  high: 'bg-high',
  critical: 'bg-critical',
  neutral: 'bg-text-dim',
}

/**
 * The "trust chain" - PayGuard's signature visual.
 * Renders USER INTENT -> ... -> DECISION as connected nodes, with a break
 * marker at the point the transaction first deviates from stated intent.
 */
export function IntentChain({ nodes, vertical = true }: { nodes: ChainNode[]; vertical?: boolean }) {
  return (
    <div className={vertical ? 'flex flex-col' : 'flex flex-row items-stretch'}>
      {nodes.map((node, i) => {
        const tier = node.tier ?? 'neutral'
        const isLast = i === nodes.length - 1
        return (
          <div key={node.key} className={vertical ? '' : 'flex-1 min-w-0'}>
            <div className={`rounded-lg border p-3 ${tierBorder[tier]} ${node.broken ? 'ring-2 ring-critical/60' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${tierDotColor[tier]}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {node.label}
                </span>
                {node.broken && (
                  <span className="ml-auto text-[10px] font-bold uppercase text-critical">deviation</span>
                )}
              </div>
              {node.detail && <div className="mt-1.5 text-sm text-text">{node.detail}</div>}
            </div>
            {!isLast && (
              vertical ? (
                <div className="flex justify-start pl-[19px] py-0.5">
                  <div className="h-4 w-px bg-border" />
                </div>
              ) : (
                <div className="flex items-center justify-center px-1">
                  <div className="h-px w-4 bg-border" />
                </div>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
