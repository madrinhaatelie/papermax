import React from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Scissors, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  Plus, 
  Printer, 
  Sparkles,
  ArrowUpRight,
  Calculator,
  Tag,
  Calendar
} from 'lucide-react';
import { Order, MaterialItem, ProductionJob, FinancialTransaction, AtelierSettings } from '../../types';
import { OrderStatusBadge } from '../../components/Badge';
import { generateOrderPdf } from '../../services/pdfGenerator';

interface DashboardViewProps {
  orders: Order[];
  materials: MaterialItem[];
  productionJobs: ProductionJob[];
  transactions: FinancialTransaction[];
  settings: AtelierSettings;
  onOpenNewOrder: () => void;
  onOpenPricingCalculator: () => void;
  onSelectOrder: (order: Order) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  materials,
  productionJobs,
  transactions,
  settings,
  onOpenNewOrder,
  onOpenPricingCalculator,
  onSelectOrder,
  onNavigateTab
}) => {
  // Financial metrics (real operational values)
  const totalIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalIncome - totalExpense;

  // Active orders
  const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
  const criticalStockItems = materials.filter(m => m.currentStock <= m.minStock);

  // Urgent deliveries (next deadlines)
  const upcomingOrders = [...activeOrders].sort((a, b) => 
    new Date(a.deliveryDeadline).getTime() - new Date(b.deliveryDeadline).getTime()
  ).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Welcome Card & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Painel do Ateliê
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Organize pedidos, prazos de entrega e produção diária em um só lugar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenPricingCalculator}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            Precificador
          </button>
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
          </button>
        </div>
      </div>

      {/* Operational Summary Grid (Clean, contextual cards without decorative clutter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Entradas & Saldo */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receitas do Mês</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Lucro: R$ {netProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Produção & Fila */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Esteira de Produção</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-sm font-semibold text-slate-800">
              Corte, impressão e montagem
            </div>
            <button 
              onClick={() => onNavigateTab('production')}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Acompanhar fila de produção &rarr;
            </button>
          </div>
        </div>

        {/* Insumos & Reposição */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estoque & Insumos</span>
            <div className={`w-8 h-8 rounded-lg ${criticalStockItems.length > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-500 border border-slate-200'} flex items-center justify-center`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-sm font-semibold text-slate-800">
              {criticalStockItems.length > 0 
                ? 'Itens com estoque abaixo do mínimo' 
                : 'Níveis de insumos adequados'}
            </div>
            <button 
              onClick={() => onNavigateTab('stock')}
              className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer ${criticalStockItems.length > 0 ? 'text-rose-600 hover:text-rose-800' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Consultar matérias-primas &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Urgent Deadlines and Atelier Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Deadlines Table (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Próximas Entregas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Pedidos organizados por data de entrega</p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Ver todos os pedidos &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold">
                  <th className="pb-3">Cliente / Pedido</th>
                  <th className="pb-3">Itens</th>
                  <th className="pb-3">Prazo</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                      Nenhum pedido pendente no momento.
                    </td>
                  </tr>
                ) : (
                  upcomingOrders.map((order) => {
                    const daysLeft = Math.ceil(
                      (new Date(order.deliveryDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const isOverdue = daysLeft < 0;
                    const isUrgent = daysLeft <= 3 && !isOverdue;

                    return (
                      <tr 
                        key={order.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => onSelectOrder(order)}
                      >
                        <td className="py-3.5 pr-3">
                          <div className="font-semibold text-slate-900">
                            {order.customerName}
                          </div>
                          <div className="text-xs text-slate-500">{order.orderNumber}</div>
                        </td>

                        <td className="py-3.5 pr-3">
                          <div className="text-xs font-medium text-slate-700 line-clamp-1">
                            {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {order.items[0]?.theme || 'Personalizado'}
                          </div>
                        </td>

                        <td className="py-3.5 pr-3 whitespace-nowrap">
                          <div className="text-xs font-semibold text-slate-800">
                            {new Date(order.deliveryDeadline).toLocaleDateString('pt-BR')}
                          </div>
                          <div className={`text-[11px] font-semibold ${isOverdue ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-slate-500'}`}>
                            {isOverdue ? 'Atrasado' : daysLeft === 0 ? 'Entrega Hoje' : `${daysLeft} dia(s)`}
                          </div>
                        </td>

                        <td className="py-3.5 pr-3">
                          <OrderStatusBadge status={order.status} />
                        </td>

                        <td className="py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateOrderPdf(order, settings);
                            }}
                            title="Imprimir Ordem de Serviço PDF"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar Tools & Shortcuts */}
        <div className="space-y-6">
          {/* Quick Access Tools */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Ferramentas de Produção
            </h3>

            <div className="space-y-2.5">
              <button
                onClick={() => onNavigateTab('personalization')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Gerador de Tags em Lote (PDF)
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={onOpenPricingCalculator}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Calculadora de Precificação Real
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigateTab('copilot')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors cursor-pointer text-left"
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Copiloto de Ideias & Textos
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Quick Support Note */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">
              Ateliê Organizado
            </h4>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Mantenha o cadastro de insumos e prazos atualizados para cálculo automático de consumo e datas de confecção.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
