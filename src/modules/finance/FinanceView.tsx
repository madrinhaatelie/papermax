import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { FinancialTransaction, Order } from '../../types';
import { TransactionModal } from './TransactionModal';

interface FinanceViewProps {
  transactions: FinancialTransaction[];
  orders: Order[];
  onSaveTransaction: (transaction: FinancialTransaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  orders,
  onSaveTransaction,
  onDeleteTransaction
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Receivables from active orders
  const pendingReceivables = orders
    .filter(o => o.status !== 'cancelled' && o.status !== 'delivered')
    .reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.amountPaid), 0);

  const filteredTransactions = transactions.filter(t => {
    return filterType === 'all' || t.type === filterType;
  });

  const categoryLabels: Record<string, string> = {
    venda_produtos: 'Venda de Produtos',
    sinal_pedido: 'Sinal de Pedido',
    compra_materia_prima: 'Papéis & Insumos',
    equipamentos_manutencao: 'Lâminas & Equipamentos',
    embalagens_frete: 'Embalagens & Frete',
    marketing_anuncios: 'Marketing & Redes',
    custos_fixos_aluguel: 'Custos Fixos',
    energia_internet: 'Energia & Internet',
    prolabore_retirada: 'Pró-Labore',
    outros: 'Outros'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Fluxo de Caixa & Financeiro
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe receitas, custos de insumos, faturamento e previsões de recebimento.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </button>
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Incomes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Receitas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            R$ {totalIncome.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Vendas e sinais de pedidos</div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Despesas</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            R$ {totalExpense.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Insumos, energia e lâminas</div>
        </div>

        {/* Net Profit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Líquido</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black mt-2 ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
            R$ {netBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-indigo-700 mt-1 font-medium">Saldo em caixa do ateliê</div>
        </div>

        {/* Pending Receivables */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">A Receber</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">
            R$ {pendingReceivables.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Restante a pagar na entrega</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'all' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Todos os Lançamentos
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'income' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Apenas Entradas
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterType === 'expense' ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Apenas Saídas
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold">
              <tr>
                <th className="py-3.5 px-4">Data / Descrição</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Forma Pgto</th>
                <th className="py-3.5 px-4">Origem / Destino</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
                <th className="py-3.5 px-4 text-center">Excluir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                    Nenhum lançamento financeiro registrado.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{t.description}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(t.date).toLocaleDateString('pt-BR')}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {categoryLabels[t.category] || t.category}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500 uppercase font-semibold">
                      {t.paymentMethod}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {t.customerOrSupplier || '-'}
                    </td>

                    <td className={`py-3.5 px-4 text-right font-bold whitespace-nowrap text-sm ${t.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Excluir lançamento "${t.description}"?`)) {
                            onDeleteTransaction(t.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveTransaction}
        orders={orders}
      />
    </div>
  );
};
