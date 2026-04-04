// src/components/StatusBadge.tsx
import type { OrderStatus, PayoutStatus } from '@/lib/types'

const ORDER_MAP: Record<OrderStatus, { label: string; cls: string }> = {
  EN_LIVRAISON: { label: 'En Livraison', cls: 'badge badge-livraison' },
  LIVREE:       { label: 'Livrée',       cls: 'badge badge-livree' },
  RETOUR:       { label: 'Retour',       cls: 'badge badge-retour' },
  ECHANGE:      { label: 'Échange',      cls: 'badge badge-echange' },
}

const PAYOUT_MAP: Record<PayoutStatus, { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'En Attente', cls: 'badge badge-attente' },
  SENT:       { label: 'Sent',       cls: 'badge badge-sent' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls } = ORDER_MAP[status] ?? { label: status, cls: 'badge' }
  return <span className={cls}>{label}</span>
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const { label, cls } = PAYOUT_MAP[status] ?? { label: status, cls: 'badge' }
  return <span className={cls}>{label}</span>
}
