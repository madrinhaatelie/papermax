import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  ArrowUpRight, 
  Edit3, 
  Trash2, 
  History
} from 'lucide-react';
import { MaterialItem, MaterialCategory, StockMovement } from '../../types';
import { StockMovementModal } from './StockMovementModal';
import { Modal } from '../../components/Modal';

interface StockViewProps {
  materials: MaterialItem[];
  movements: StockMovement[];
  onSaveMaterial: (mat: MaterialItem) => void;
  onDeleteMaterial: (id: string) => void;
  onSaveMovement: (movement: Omit<StockMovement, 'id' | 'date'>) => void;
}

export const StockView: React.FC<StockViewProps> = ({
  materials,
  movements,
  onSaveMaterial,
  onDeleteMaterial,
  onSaveMovement
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [preselectedMaterialId, setPreselectedMaterialId] = useState<string | undefined>();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Material Add/Edit form state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<MaterialItem | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('papeis_especiais');
  const [unit, setUnit] = useState<'un' | 'fl' | 'm' | 'kg' | 'g' | 'pct' | 'rl'>('fl');
  const [currentStock, setCurrentStock] = useState(100);
  const [minStock, setMinStock] = useState(30);
  const [unitCost, setUnitCost] = useState(0.50);
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.supplier && m.supplier.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    const matchesCritical = !showCriticalOnly || m.currentStock <= m.minStock;

    return matchesSearch && matchesCategory && matchesCritical;
  });

  const categoryLabels: Record<MaterialCategory, string> = {
    papeis_especiais: 'Papéis Especiais / Color Plus',
    papeis_fotograficos: 'Papéis Fotográficos / Glossy',
    laminacao_bopp: 'Filmes BOPP / Plastificação',
    fitas_aviamentos: 'Fitas de Cetim / Gorgurão',
    pedrarias_shakers: 'Pedrarias / Chatons / Shaker',
    ferragens_encadernacao: 'Wire-o / Ilhós / Ferragens',
    colas_adesivos: 'Colas / Fita Banana / Dupla Face',
    embalagens_envio: 'Embalagens / Caixas de Correio',
    tintas_toners: 'Tintas / Toners / Cartuchos'
  };

  const handleOpenEdit = (mat?: MaterialItem) => {
    if (mat) {
      setMaterialToEdit(mat);
      setCode(mat.code);
      setName(mat.name);
      setCategory(mat.category);
      setUnit(mat.unit);
      setCurrentStock(mat.currentStock);
      setMinStock(mat.minStock);
      setUnitCost(mat.unitCost);
      setSupplier(mat.supplier || '');
      setLocation(mat.location || '');
    } else {
      setMaterialToEdit(null);
      setCode(`MAT-${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setCategory('papeis_especiais');
      setUnit('fl');
      setCurrentStock(50);
      setMinStock(20);
      setUnitCost(0.80);
      setSupplier('');
      setLocation('');
    }
    setIsEditModalOpen(true);
  };

  const handleSaveMaterialForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      alert('Preencha o nome e o código do insumo.');
      return;
    }

    const saved: MaterialItem = {
      id: materialToEdit ? materialToEdit.id : 'mat_' + Date.now(),
      code,
      name,
      category,
      unit,
      currentStock: Number(currentStock),
      minStock: Number(minStock),
      unitCost: Number(unitCost),
      supplier,
      location,
      lastRestocked: materialToEdit ? materialToEdit.lastRestocked : new Date().toISOString().split('T')[0]
    };

    onSaveMaterial(saved);
    setIsEditModalOpen(false);
  };

  const totalInventoryValue = materials.reduce((sum, m) => sum + (m.currentStock * m.unitCost), 0);
  const criticalCount = materials.filter(m => m.currentStock <= m.minStock).length;

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Estoque de Matéria-Prima & Insumos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle papéis, fitas, BOPP, chatons e aviamentos com alertas de reposição.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-400" />
            Histórico
          </button>

          <button
            onClick={() => {
              setPreselectedMaterialId(undefined);
              setIsMovementModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-indigo-600" />
            Lançar Movimento
          </button>

          <button
            onClick={() => handleOpenEdit()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Material
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Valor Total em Estoque</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              R$ {totalInventoryValue.toFixed(2)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs ${criticalCount > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div>
            <div className={`text-xs font-semibold ${criticalCount > 0 ? 'text-rose-800' : 'text-slate-500'}`}>
              Status de Reposição
            </div>
            <div className={`text-base font-bold mt-0.5 ${criticalCount > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {criticalCount > 0 ? 'Existem itens abaixo do estoque mínimo' : 'Todos os insumos com saldo regular'}
            </div>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${criticalCount > 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, código ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 flex-1 md:flex-none"
          >
            <option value="all">Todas as Categorias</option>
            {Object.entries(categoryLabels).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              showCriticalOnly
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            Apenas Críticos
          </button>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold">
              <tr>
                <th className="py-3.5 px-4">Código / Insumo</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4 text-center">Estoque Atual</th>
                <th className="py-3.5 px-4 text-center">Mínimo</th>
                <th className="py-3.5 px-4 text-right">Custo Unitário</th>
                <th className="py-3.5 px-4 text-right">Total Estocado</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Nenhum material encontrado.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((mat) => {
                  const isLow = mat.currentStock <= mat.minStock;
                  const totalVal = mat.currentStock * mat.unitCost;

                  return (
                    <tr key={mat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>{mat.name}</span>
                          {isLow && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Baixo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{mat.code} • Local: {mat.location || 'Ateliê'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {categoryLabels[mat.category] || mat.category}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`text-sm font-bold ${isLow ? 'text-rose-700' : 'text-slate-900'}`}>
                          {mat.currentStock}
                        </span>
                        <span className="text-xs text-slate-500 ml-1 font-medium">{mat.unit}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs text-slate-500">
                        {mat.minStock} {mat.unit}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs font-semibold text-slate-700">
                        R$ {mat.unitCost.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs font-bold text-slate-900">
                        R$ {totalVal.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setPreselectedMaterialId(mat.id);
                              setIsMovementModalOpen(true);
                            }}
                            title="Lançar Entrada ou Saída"
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-indigo-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          >
                            +/- Mov
                          </button>

                          <button
                            onClick={() => handleOpenEdit(mat)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Excluir ${mat.name}?`)) {
                                onDeleteMaterial(mat.id);
                              }
                            }}
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

      {/* Movement Modal */}
      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSaveMovement={onSaveMovement}
        materials={materials}
        preselectedMaterialId={preselectedMaterialId}
      />

      {/* Material Add / Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={materialToEdit ? `Editar ${materialToEdit.name}` : 'Cadastrar Novo Insumo'}
        subtitle="Defina ponto de ressuprimento, unidade de medida e fornecedor."
        maxWidth="xl"
      >
        <form onSubmit={handleSaveMaterialForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Código / Ref *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria *</label>
              <select
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              >
                {Object.entries(categoryLabels).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Insumo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Papel Color Plus 180g Verona (Rosa Bebê)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade de Medida</label>
              <select
                value={unit}
                onChange={(e: any) => setUnit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              >
                <option value="fl">Folhas (fl)</option>
                <option value="un">Unidades (un)</option>
                <option value="m">Metros (m)</option>
                <option value="rl">Rolos (rl)</option>
                <option value="pct">Pacotes (pct)</option>
                <option value="kg">Quilos (kg)</option>
                <option value="g">Gramas (g)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Estoque Inicial / Atual</label>
              <input
                type="number"
                step="0.1"
                required
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-700 mb-1">Estoque Mínimo (Alerta)</label>
              <input
                type="number"
                step="0.1"
                required
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full bg-slate-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fornecedor Principal</label>
              <input
                type="text"
                placeholder="Ex: Tex Papéis / Kalunga"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Localização no Ateliê</label>
              <input
                type="text"
                placeholder="Ex: Gaveta A2 / Prateleira 3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Salvar Insumo
            </button>
          </div>
        </form>
      </Modal>

      {/* Movement History Log Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Histórico de Movimentações"
        subtitle="Registro de auditoria de entradas, saídas e consumos de matéria-prima."
        maxWidth="3xl"
      >
        <div className="space-y-3">
          {movements.length === 0 ? (
            <p className="text-center py-6 text-slate-400 text-xs">Nenhum movimento registrado.</p>
          ) : (
            movements.map((mov) => (
              <div 
                key={mov.id} 
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <span>{mov.materialName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      mov.type === 'in' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : mov.type === 'order_consumed'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {mov.type === 'in' ? '+ Entrada' : mov.type === 'order_consumed' ? 'Consumo Pedido' : '- Baixa'}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Motivo: {mov.reason} • {new Date(mov.date).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-900 text-sm">
                    {mov.type === 'in' ? '+' : '-'}{mov.quantity}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Saldo: {mov.previousStock} &rarr; {mov.newStock}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
