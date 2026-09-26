import React, { useState } from 'react';
import { Calculator, Sparkles } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { AtelierSettings } from '../../types';

interface PricingCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AtelierSettings;
}

export const PricingCalculatorModal: React.FC<PricingCalculatorModalProps> = ({
  isOpen,
  onClose,
  settings
}) => {
  // Inputs
  const [productName, setProductName] = useState('Caixa Cenário Luxo Shaker');
  const [materialsCost, setMaterialsCost] = useState<number>(4.50);
  const [machineDepreciationCost, setMachineDepreciationCost] = useState<number>(0.80);
  const [assemblyMinutes, setAssemblyMinutes] = useState<number>(20);
  const [hourlyLaborRate, setHourlyLaborRate] = useState<number>(settings.hourlyLaborRate || 35.00);
  const [packagingAndFinishingCost, setPackagingAndFinishingCost] = useState<number>(1.20);
  const [targetMarkup, setTargetMarkup] = useState<number>(settings.defaultMarkup || 2.6);
  const [batchQuantity, setBatchQuantity] = useState<number>(10);

  // Calculations
  const laborCostPerUnit = (hourlyLaborRate / 60) * assemblyMinutes;
  const totalCostPerUnit = Number(materialsCost) + Number(machineDepreciationCost) + Number(packagingAndFinishingCost) + laborCostPerUnit;
  const suggestedPricePerUnit = totalCostPerUnit * Number(targetMarkup);
  const grossProfitPerUnit = suggestedPricePerUnit - totalCostPerUnit;
  const profitMarginPercent = suggestedPricePerUnit > 0 ? (grossProfitPerUnit / suggestedPricePerUnit) * 100 : 0;

  // Batch calculations
  const batchTotalCost = totalCostPerUnit * batchQuantity;
  const batchTotalRevenue = suggestedPricePerUnit * batchQuantity;
  const batchTotalProfit = grossProfitPerUnit * batchQuantity;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calculadora Inteligente de Precificação"
      subtitle="Calcule custos de papéis, desgaste de máquinas, mão de obra e margem de lucro real."
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Produto / Peça
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              1. Custo de Insumos (Papéis, Fitas, Shakers)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
              <input
                type="number"
                step="0.01"
                value={materialsCost}
                onChange={(e) => setMaterialsCost(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              2. Desgaste de Máquinas & Lâminas / Impressão
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
              <input
                type="number"
                step="0.01"
                value={machineDepreciationCost}
                onChange={(e) => setMachineDepreciationCost(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              3. Tempo de Produção e Montagem
            </label>
            <div className="relative">
              <input
                type="number"
                value={assemblyMinutes}
                onChange={(e) => setAssemblyMinutes(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">minutos</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              4. Valor da sua Hora de Trabalho (R$/h)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
              <input
                type="number"
                step="0.50"
                value={hourlyLaborRate}
                onChange={(e) => setHourlyLaborRate(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              5. Embalagem & Sacolinha
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
              <input
                type="number"
                step="0.10"
                value={packagingAndFinishingCost}
                onChange={(e) => setPackagingAndFinishingCost(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              6. Multiplicador de Markup Alvo
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={targetMarkup}
                onChange={(e) => setTargetMarkup(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-indigo-700 font-bold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">x</span>
            </div>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Resultado da Precificação
            </span>
            <span className="text-xs text-slate-600">
              Custo Total Unitário: <strong>R$ {totalCostPerUnit.toFixed(2)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Preço de Venda Unitário</div>
              <div className="text-xl font-black text-indigo-700 mt-1">
                R$ {suggestedPricePerUnit.toFixed(2)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Lucro Líquido Unitário</div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                R$ {grossProfitPerUnit.toFixed(2)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Margem Real de Lucro</div>
              <div className="text-xl font-black text-purple-700 mt-1">
                {profitMarginPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Batch simulation */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Simulação p/ Kit de:</span>
              <input
                type="number"
                min="1"
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(Number(e.target.value))}
                className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-center font-bold text-slate-900"
              />
              <span className="text-slate-600">peças:</span>
            </div>
            <div className="text-right">
              <span className="text-slate-600">Preço do Lote: </span>
              <strong className="text-slate-900 text-sm">R$ {batchTotalRevenue.toFixed(2)}</strong>
              <span className="text-emerald-700 text-xs ml-2 font-semibold">(Lucro: R$ {batchTotalProfit.toFixed(2)})</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Concluir Consulta
          </button>
        </div>
      </div>
    </Modal>
  );
};
