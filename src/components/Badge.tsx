import React from 'react';
import { OrderStatus, PaymentStatus } from '../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'sm' }) => {
  const variantStyles = {
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {children}
    </span>
  );
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const config: Record<OrderStatus, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' }> = {
    draft: { label: 'Orçamento', variant: 'neutral' },
    pending_payment: { label: 'Aguardando Pagamento', variant: 'warning' },
    art_creation: { label: 'Criação de Arte', variant: 'purple' },
    art_approval: { label: 'Aguardando Aprovação', variant: 'info' },
    art_approved: { label: 'Arte Aprovada', variant: 'success' },
    in_production: { label: 'Em Produção', variant: 'primary' },
    ready: { label: 'Pronto p/ Entrega', variant: 'success' },
    delivered: { label: 'Entregue / Concluído', variant: 'neutral' },
    cancelled: { label: 'Cancelado', variant: 'danger' }
  };

  const current = config[status] || { label: status, variant: 'neutral' };
  return <Badge variant={current.variant}>{current.label}</Badge>;
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const config: Record<PaymentStatus, { label: string; variant: 'primary' | 'success' | 'warning' | 'danger' }> = {
    unpaid: { label: 'Pendente', variant: 'danger' },
    partial: { label: 'Sinal Pago', variant: 'warning' },
    paid: { label: 'Pago', variant: 'success' },
    refunded: { label: 'Estornado', variant: 'danger' }
  };

  const current = config[status] || { label: status, variant: 'neutral' };
  return <Badge variant={current.variant}>{current.label}</Badge>;
};
