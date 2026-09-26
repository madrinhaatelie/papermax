import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Printer, 
  MessageCircle, 
  Trash2, 
  Edit3, 
  LayoutGrid,
  List
} from 'lucide-react';
import { Order, OrderStatus, Product, AtelierSettings } from '../../types';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/Badge';
import { generateOrderPdf } from '../../services/pdfGenerator';
import { OrderModal } from './OrderModal';
import { Modal } from '../../components/Modal';
import { OrderApprovalView } from './OrderApprovalView';

interface OrdersViewProps {
  orders: Order[];
  products: Product[];
  settings: AtelierSettings;
  onSaveOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  products,
  settings,
  onSaveOrder,
  onDeleteOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [approvalOrder, setApprovalOrder] = useState<Order | null>(null);

  // Filtering
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerWhatsapp.includes(searchTerm) ||
      order.items.some(i => i.productName.toLowerCase().includes(searchTerm.toLowerCase()) || i.theme.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openWhatsApp = (order: Order) => {
    const text = encodeURIComponent(
      `Olá ${order.customerName}! Aqui é do ${settings.name}. Entramos em contato a respeito do seu pedido *${order.orderNumber}*. Qualquer dúvida estamos à disposição!`
    );
    const cleanPhone = order.customerWhatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}?text=${text}`, '_blank');
  };

  const kanbanColumns: { status: OrderStatus; label: string; color: string }[] = [
    { status: 'draft', label: 'Orçamento', color: 'border-slate-200 bg-slate-50/70' },
    { status: 'pending_payment', label: 'Aguardando Pagamento', color: 'border-amber-200 bg-amber-50/40' },
    { status: 'art_creation', label: 'Criação da Arte', color: 'border-purple-200 bg-purple-50/40' },
    { status: 'art_approval', label: 'Aprovação do Cliente', color: 'border-sky-200 bg-sky-50/40' },
    { status: 'in_production', label: 'Em Produção', color: 'border-indigo-200 bg-indigo-50/40' },
    { status: 'ready', label: 'Pronto p/ Envio', color: 'border-emerald-200 bg-emerald-50/40' },
    { status: 'delivered', label: 'Concluído', color: 'border-slate-200 bg-slate-50/50' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Pedidos & Encomendas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento de orçamentos, aprovações de arte e ordens de serviço.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" /> Tabela
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'kanban' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
          </div>

          <button
            onClick={() => {
              setOrderToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, pedido, WhatsApp, tema ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'pending_payment', label: 'Aguard. Pagamento' },
            { id: 'art_approval', label: 'Aprovação de Arte' },
            { id: 'in_production', label: 'Em Produção' },
            { id: 'ready', label: 'Prontos' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW MODE: TABLE */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Pedido / Cliente</th>
                  <th className="py-3.5 px-4">Produtos & Tema</th>
                  <th className="py-3.5 px-4">Prazo de Entrega</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Pagamento</th>
                  <th className="py-3.5 px-4 text-right">Valor Total</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const daysLeft = Math.ceil(
                      (new Date(order.deliveryDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const isOverdue = daysLeft < 0;

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{order.customerName}</div>
                          <div className="text-xs text-slate-500">{order.orderNumber}</div>
                          <div className="text-[11px] text-slate-400">{order.customerWhatsapp}</div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="text-xs font-medium text-slate-800 line-clamp-1">
                            {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                          </div>
                          <div className="text-[11px] text-indigo-600 font-medium">
                            Tema: {order.items[0]?.theme || 'Sem tema'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-slate-800">
                            {new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}
                          </div>
                          <div className={`text-[11px] font-medium ${isOverdue ? 'text-rose-600 font-bold' : daysLeft <= 3 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                            {isOverdue ? 'Atrasado' : `${daysLeft} dia(s) restante(s)`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <OrderStatusBadge status={order.status} />
                            {order.status === 'art_approval' && (
                              <button
                                onClick={() => setApprovalOrder(order)}
                                className="block text-[11px] text-sky-700 hover:text-sky-900 font-semibold underline cursor-pointer"
                              >
                                Ver Aprovação &rarr;
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <PaymentStatusBadge status={order.paymentStatus} />
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Pago: R$ {order.amountPaid.toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            R$ {order.totalAmount.toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => generateOrderPdf(order, settings)}
                              title="Gerar Ordem de Serviço PDF"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => openWhatsApp(order)}
                              title="Abrir WhatsApp da Cliente"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setOrderToEdit(order);
                                setIsModalOpen(true);
                              }}
                              title="Editar Pedido"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir o pedido ${order.orderNumber}?`)) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              title="Excluir Pedido"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW MODE: KANBAN */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map((col) => {
            const columnOrders = filteredOrders.filter(o => o.status === col.status);
            return (
              <div 
                key={col.status}
                className={`rounded-2xl border p-3 min-w-[240px] flex flex-col ${col.color}`}
              >
                <div className="mb-3 px-1">
                  <h4 className="text-xs font-bold text-slate-800">{col.label}</h4>
                </div>

                <div className="space-y-2.5 flex-1">
                  {columnOrders.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Sem pedidos
                    </div>
                  ) : (
                    columnOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-indigo-400 transition-colors space-y-2 cursor-pointer"
                        onClick={() => {
                          setOrderToEdit(order);
                          setIsModalOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-700">{order.orderNumber}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <div className="font-semibold text-xs text-slate-900">{order.customerName}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-1">
                          {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="font-bold text-slate-800">R$ {order.totalAmount.toFixed(2)}</span>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                generateOrderPdf(order, settings);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <OrderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setOrderToEdit(null);
        }}
        onSave={onSaveOrder}
        orderToEdit={orderToEdit}
        products={products}
      />

      {/* Art Approval Portal Modal */}
      {approvalOrder && (
        <Modal
          isOpen={true}
          onClose={() => setApprovalOrder(null)}
          title="Aprovação Digital de Arte"
          subtitle="Conferência de arte para validação do cliente."
          maxWidth="4xl"
        >
          <OrderApprovalView
            order={approvalOrder}
            settings={settings}
            onUpdateOrder={(updated) => {
              onSaveOrder(updated);
              setApprovalOrder(updated);
            }}
            onClose={() => setApprovalOrder(null)}
          />
        </Modal>
      )}
    </div>
  );
};
