import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Product, ProductCategory, MaterialItem, MaterialRequirement } from '../../types';
import { Modal } from '../../components/Modal';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  productToEdit?: Product | null;
  materials: MaterialItem[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  materials
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('topos_de_bolo');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState(0);
  const [productionTimeMinutes, setProductionTimeMinutes] = useState(30);
  const [minQuantity, setMinQuantity] = useState(1);
  const [suggestedMarkup, setSuggestedMarkup] = useState(2.8);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialRequirement[]>([]);

  // Subform to add material requirement
  const [selectedMatId, setSelectedMatId] = useState('');
  const [matQty, setMatQty] = useState(1);

  useEffect(() => {
    if (productToEdit) {
      setSku(productToEdit.sku);
      setName(productToEdit.name);
      setCategory(productToEdit.category);
      setDescription(productToEdit.description);
      setBasePrice(productToEdit.basePrice);
      setProductionTimeMinutes(productToEdit.productionTimeMinutes);
      setMinQuantity(productToEdit.minQuantity);
      setSuggestedMarkup(productToEdit.suggestedMarkup);
      setSelectedMaterials(productToEdit.materials || []);
    } else {
      setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
      setName('');
      setCategory('topos_de_bolo');
      setDescription('');
      setBasePrice(35.00);
      setProductionTimeMinutes(25);
      setMinQuantity(1);
      setSuggestedMarkup(2.8);
      setSelectedMaterials([]);
    }
  }, [productToEdit, isOpen]);

  const handleAddMaterial = () => {
    const mat = materials.find(m => m.id === selectedMatId);
    if (!mat) return;

    const estimatedCost = Number(matQty) * mat.unitCost;
    const req: MaterialRequirement = {
      materialId: mat.id,
      materialName: mat.name,
      quantityNeeded: Number(matQty),
      unit: mat.unit,
      estimatedCost
    };

    setSelectedMaterials([...selectedMaterials, req]);
    setSelectedMatId('');
    setMatQty(1);
  };

  const handleRemoveMaterial = (matId: string) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.materialId !== matId));
  };

  const calculatedMaterialsCost = selectedMaterials.reduce((sum, m) => sum + m.estimatedCost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku) {
      alert('Preencha o nome e o código SKU do produto.');
      return;
    }

    const savedProduct: Product = {
      id: productToEdit ? productToEdit.id : 'prod_' + Date.now(),
      sku,
      name,
      category,
      description,
      basePrice: Number(basePrice),
      costPrice: calculatedMaterialsCost,
      productionTimeMinutes: Number(productionTimeMinutes),
      minQuantity: Number(minQuantity),
      suggestedMarkup: Number(suggestedMarkup),
      materials: selectedMaterials,
      active: true
    };

    onSave(savedProduct);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? `Editar ${productToEdit.name}` : 'Novo Produto no Catálogo'}
      subtitle="Defina a ficha técnica, insumos consumidos por unidade e tempo de confecção."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Main Product Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Código / SKU *</label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Produto *</label>
            <input
              type="text"
              required
              placeholder="Ex: Topo de Bolo Shaker Luxo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            >
              <option value="topos_de_bolo">Topos de Bolo</option>
              <option value="caixas_luxo">Caixas Luxo / Cenário</option>
              <option value="sacolas_lembrancinhas">Sacolas & Lembrancinhas</option>
              <option value="agendas_planners">Agendas & Planners</option>
              <option value="cadernos_bloquinhos">Cadernos & Bloquinhos</option>
              <option value="adesivos_tags">Adesivos & Tags</option>
              <option value="kits_festa">Kits Festa Prontos</option>
              <option value="convites">Convites Especiais</option>
              <option value="cartonagem">Cartonagem</option>
              <option value="brindes_corporativos">Brindes Corporativos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-indigo-700 mb-1">Preço de Venda Base (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-base sm:text-sm text-indigo-700 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tempo de Produção (min)</label>
            <input
              type="number"
              value={productionTimeMinutes}
              onChange={(e) => setProductionTimeMinutes(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição / Especificações</label>
            <textarea
              rows={2}
              placeholder="Descreva papéis suportados, camadas, apliques e embalagem..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-xs text-slate-900"
            />
          </div>
        </div>

        {/* Ficha Técnica (BOM - Bill of Materials) */}
        <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              Ficha Técnica (Insumos Consumidos por Unidade)
            </h4>
            <span className="text-xs text-emerald-700 font-bold">
              Custo Estimado: R$ {calculatedMaterialsCost.toFixed(2)}
            </span>
          </div>

          {/* Add Material Subform */}
          <div className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
            <select
              value={selectedMatId}
              onChange={(e) => setSelectedMatId(e.target.value)}
              className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-base sm:text-xs text-slate-800"
            >
              <option value="">-- Selecionar Insumo do Estoque --</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} (R$ {m.unitCost.toFixed(2)}/{m.unit})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="number"
                step="0.05"
                min="0.01"
                placeholder="Qtd"
                value={matQty}
                onChange={(e) => setMatQty(Number(e.target.value))}
                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-base sm:text-xs text-slate-800 text-center"
              />
              <button
                type="button"
                onClick={handleAddMaterial}
                className="px-3.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                Incluir
              </button>
            </div>
          </div>

          {/* Material Requirements Table */}
          {selectedMaterials.length > 0 ? (
            <div className="space-y-1.5">
              {selectedMaterials.map((mat) => (
                <div 
                  key={mat.materialId}
                  className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs"
                >
                  <div className="text-slate-800">
                    <span className="font-semibold">{mat.materialName}</span>
                    <span className="text-slate-500 ml-2">
                      ({mat.quantityNeeded} {mat.unit})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700">R$ {mat.estimatedCost.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(mat.materialId)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-2">
              Nenhum insumo vinculado a esta ficha técnica ainda.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Salvar Produto
          </button>
        </div>
      </form>
    </Modal>
  );
};
