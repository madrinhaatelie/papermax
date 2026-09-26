import React, { useState, useEffect } from 'react';
import { MaterialItem, StockMovement } from '../../types';
import { Modal } from '../../components/Modal';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMovement: (movement: Omit<StockMovement, 'id' | 'date'>) => void;
  materials: MaterialItem[];
  preselectedMaterialId?: string;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  onSaveMovement,
  materials,
  preselectedMaterialId
}) => {
  const [materialId, setMaterialId] = useState(preselectedMaterialId || '');
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (preselectedMaterialId) {
      setMaterialId(preselectedMaterialId);
    } else if (materials.length > 0 && !materialId) {
      setMaterialId(materials[0].id);
    }
  }, [preselectedMaterialId, materials, isOpen]);

  const selectedMat = materials.find(m => m.id === materialId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMat) {
      alert('Selecione um material.');
      return;
    }

    const currentStock = selectedMat.currentStock;
    let newStock = currentStock;

    if (type === 'in') {
      newStock += Number(quantity);
    } else if (type === 'out') {
      newStock = Math.max(0, currentStock - Number(quantity));
    } else if (type === 'adjustment') {
      newStock = Number(quantity);
    }

    onSaveMovement({
      materialId: selectedMat.id,
      materialName: selectedMat.name,
      type,
      quantity: Number(quantity),
      previousStock: currentStock,
      newStock,
      reason: reason || (type === 'in' ? 'Entrada de compra / reposição' : 'Ajuste manual de estoque')
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Movimentação de Estoque"
      subtitle="Lance compras, reposições, baixas por perdas de corte ou auditorias."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Material / Insumo *
          </label>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
          >
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} (Atual: {m.currentStock} {m.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tipo de Movimentação
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType('in')}
              className={`py-2.5 sm:py-2 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer min-h-[44px] flex items-center justify-center ${
                type === 'in'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              + Entrada de Estoque
            </button>
            <button
              type="button"
              onClick={() => setType('out')}
              className={`py-2.5 sm:py-2 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer min-h-[44px] flex items-center justify-center ${
                type === 'out'
                  ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              - Saída / Perda / Uso
            </button>
            <button
              type="button"
              onClick={() => setType('adjustment')}
              className={`py-2.5 sm:py-2 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer min-h-[44px] flex items-center justify-center ${
                type === 'adjustment'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              = Balanço / Inventário
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {type === 'adjustment' ? 'Novo Saldo Contado em Estoque' : 'Quantidade a Movimentar'}
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-900 font-bold"
            />
            {selectedMat && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {selectedMat.unit}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Motivo / Nota Fiscal / Observação
          </label>
          <input
            type="text"
            placeholder="Ex: Compra Kalunga NF 1234, ajuste de corte, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
          />
        </div>

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
            Confirmar Movimentação
          </button>
        </div>
      </form>
    </Modal>
  );
};
