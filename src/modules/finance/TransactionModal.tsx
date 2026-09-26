import React, { useState } from 'react';
import { FinancialTransaction, TransactionType, TransactionCategory, PaymentMethod, Order } from '../../types';
import { Modal } from '../../components/Modal';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: FinancialTransaction) => void;
  orders: Order[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  orders
}) => {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('income');
  const [category, setCategory] = useState<TransactionCategory>('venda_produtos');
  const [amount, setAmount] = useState<number>(100);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [customerOrSupplier, setCustomerOrSupplier] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const incomeCategories: { id: TransactionCategory; label: string }[] = [
    { id: 'venda_produtos', label: 'Venda de Produtos / Kits' },
    { id: 'sinal_pedido', label: 'Sinal de Pedido (50%)' },
    { id: 'outros', label: 'Outras Entradas' }
  ];

  const expenseCategories: { id: TransactionCategory; label: string }[] = [
    { id: 'compra_materia_prima', label: 'Papéis, Fitas & Aviamentos' },
    { id: 'equipamentos_manutencao', label: 'Lâminas, Bases & Manutenção' },
    { id: 'embalagens_frete', label: 'Embalagens & Correios/Motoboy' },
    { id: 'energia_internet', label: 'Energia Elétrica & Internet' },
    { id: 'marketing_anuncios', label: 'Anúncios & Divulgação' },
    { id: 'custos_fixos_aluguel', label: 'Aluguel / Custos Fixos' },
    { id: 'prolabore_retirada', label: 'Pró-Labore / Retirada Artesã' },
    { id: 'outros', label: 'Outras Despesas' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) {
      alert('Preencha a descrição e o valor do lançamento.');
      return;
    }

    const newTrans: FinancialTransaction = {
      id: 'trans_' + Date.now(),
      description,
      type,
      category,
      amount: Number(amount),
      date,
      paymentMethod,
      orderId: selectedOrderId || undefined,
      customerOrSupplier,
      status: 'completed'
    };

    onSave(newTrans);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo Lançamento Financeiro"
      subtitle="Registre recebimentos de clientes, compras de papel ou despesas do ateliê."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setType('income');
              setCategory('venda_produtos');
            }}
            className={`py-2.5 sm:py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
              type === 'income'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            + Entrada / Receita
          </button>
          <button
            type="button"
            onClick={() => {
              setType('expense');
              setCategory('compra_materia_prima');
            }}
            className={`py-2.5 sm:py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
              type === 'expense'
                ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            - Saída / Despesa
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição *</label>
          <input
            type="text"
            required
            placeholder="Ex: Pagamento 50% Topo de Bolo, Compra Papéis Fedrigoni"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            >
              {(type === 'income' ? incomeCategories : expenseCategories).map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Forma de Pagamento</label>
            <select
              value={paymentMethod}
              onChange={(e: any) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            >
              <option value="pix">Pix</option>
              <option value="credit_card">Cartão de Crédito</option>
              <option value="debit_card">Cartão de Débito</option>
              <option value="cash">Dinheiro</option>
              <option value="transfer">Transferência</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente / Fornecedor</label>
          <input
            type="text"
            placeholder="Ex: Mariana Silveira / Tex Papéis"
            value={customerOrSupplier}
            onChange={(e) => setCustomerOrSupplier(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
          />
        </div>

        {type === 'income' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vincular a Pedido (Opcional)</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            >
              <option value="">-- Nenhum --</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} - {o.customerName} (R$ {o.totalAmount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-auto text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            Registrar Lançamento
          </button>
        </div>
      </form>
    </Modal>
  );
};
