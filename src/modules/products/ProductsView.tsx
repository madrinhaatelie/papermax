import React, { useState } from 'react';
import { Plus, Search, Layers, Calculator, Edit3, Trash2, Clock } from 'lucide-react';
import { Product, ProductCategory, MaterialItem, AtelierSettings } from '../../types';
import { ProductModal } from './ProductModal';
import { PricingCalculatorModal } from './PricingCalculatorModal';

interface ProductsViewProps {
  products: Product[];
  materials: MaterialItem[];
  settings: AtelierSettings;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  materials,
  settings,
  onSaveProduct,
  onDeleteProduct
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categoryLabels: Record<ProductCategory, string> = {
    topos_de_bolo: 'Topos de Bolo',
    caixas_luxo: 'Caixas Luxo / Cenário',
    sacolas_lembrancinhas: 'Sacolas & Lembrancinhas',
    agendas_planners: 'Agendas & Planners',
    cadernos_bloquinhos: 'Cadernos & Bloquinhos',
    adesivos_tags: 'Adesivos & Tags',
    kits_festa: 'Kits Festa Prontos',
    convites: 'Convites Especiais',
    cartonagem: 'Cartonagem',
    brindes_corporativos: 'Brindes Corporativos'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Catálogo & Fichas Técnicas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre modelos de produtos, insumos consumidos por unidade e tempo de produção.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            Precificador
          </button>

          <button
            onClick={() => {
              setProductToEdit(null);
              setIsProductModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou descrição do produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 w-full md:w-auto"
        >
          <option value="all">Todas as Categorias</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm">
            Nenhum produto cadastrado no momento.
          </div>
        ) : (
          filteredProducts.map((product) => {
            return (
              <div
                key={product.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {categoryLabels[product.category] || product.category}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{product.sku}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{product.description}</p>
                  </div>

                  {/* Production specs */}
                  <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      {product.productionTimeMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Ficha técnica ativa
                    </span>
                  </div>

                  {/* Bill of materials preview */}
                  {product.materials.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 text-[11px] space-y-1">
                      <span className="text-slate-500 font-medium">Insumos da Ficha:</span>
                      <div className="text-slate-700 line-clamp-2">
                        {product.materials.map(m => `${m.quantityNeeded}${m.unit} ${m.materialName.split(' ')[0]}`).join(' • ')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500">Custo Insumos: R$ {product.costPrice.toFixed(2)}</div>
                    <div className="text-lg font-black text-slate-900">
                      R$ {product.basePrice.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setProductToEdit(product);
                        setIsProductModalOpen(true);
                      }}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir ${product.name}?`)) {
                          onDeleteProduct(product.id);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
        }}
        onSave={onSaveProduct}
        productToEdit={productToEdit}
        materials={materials}
      />

      <PricingCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        settings={settings}
      />
    </div>
  );
};
