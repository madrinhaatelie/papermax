import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Layers, 
  Package, 
  Scissors, 
  Sparkles, 
  Tag, 
  DollarSign, 
  Settings, 
  AlertTriangle,
  FolderSync,
  Menu,
  X
} from 'lucide-react';

export type ActiveTab = 
  | 'dashboard' 
  | 'orders' 
  | 'products' 
  | 'stock' 
  | 'production' 
  | 'personalization' 
  | 'finance' 
  | 'copilot' 
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  criticalStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  criticalStockCount
}) => {
  const menuItems: { id: ActiveTab; label: string; icon: any }[] = [
    {
      id: 'dashboard',
      label: 'Visão Geral',
      icon: LayoutDashboard
    },
    {
      id: 'orders',
      label: 'Pedidos & Aprovação',
      icon: ShoppingBag
    },
    {
      id: 'production',
      label: 'Esteira de Produção',
      icon: Scissors
    },
    {
      id: 'products',
      label: 'Catálogo & Fichas',
      icon: Layers
    },
    {
      id: 'stock',
      label: 'Estoque & Insumos',
      icon: Package
    },
    {
      id: 'personalization',
      label: 'Tags & Lote em PDF',
      icon: Tag
    },
    {
      id: 'finance',
      label: 'Financeiro & Caixa',
      icon: DollarSign
    },
    {
      id: 'copilot',
      label: 'Copiloto IA',
      icon: Sparkles
    },
    {
      id: 'settings',
      label: 'Configurações & Backup',
      icon: Settings
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 hidden md:flex">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
          <FolderSync className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
            PAPER MAX
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              ERP
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">Gestão de Ateliê</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Contextual Stock Alert if critical */}
      {criticalStockCount > 0 && (
        <div className="p-3 mx-3 mb-3 rounded-xl bg-rose-50 border border-rose-200">
          <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Reposição de Insumos</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Há materiais com quantidade abaixo do estoque mínimo.
          </p>
          <button
            onClick={() => setActiveTab('stock')}
            className="mt-2 text-xs font-medium text-rose-700 hover:text-rose-800 underline cursor-pointer"
          >
            Verificar estoque &rarr;
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Paper Max</span>
        <span className="flex items-center gap-1.5 text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sistema Ativo
        </span>
      </div>
    </aside>
  );
};

export const MobileHeader: React.FC<{
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}> = ({ activeTab, setActiveTab }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs: { id: ActiveTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
    { id: 'production', label: 'Produção', icon: Scissors },
    { id: 'stock', label: 'Estoque', icon: Package }
  ];

  const secondaryTabs: { id: ActiveTab; label: string; desc: string; icon: any }[] = [
    { id: 'finance', label: 'Financeiro & Caixa', desc: 'Fluxo de caixa, entradas e saídas', icon: DollarSign },
    { id: 'products', label: 'Catálogo & Fichas', desc: 'Modelos e ficha técnica de insumos', icon: Layers },
    { id: 'personalization', label: 'Tags & Lote em PDF', desc: 'Impressão rápida com marcas de corte', icon: Tag },
    { id: 'copilot', label: 'Copiloto IA', desc: 'Ideias de temas, cores e legendas', icon: Sparkles },
    { id: 'settings', label: 'Configurações & Backup', desc: 'Dados do ateliê e exportação JSON', icon: Settings }
  ];

  const isMoreActive = secondaryTabs.some(t => t.id === activeTab);

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 backdrop-blur-md px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around shadow-lg">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsMoreOpen(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-semibold min-h-[44px] transition-colors cursor-pointer ${
                isActive ? 'text-indigo-600 font-bold bg-indigo-50/70' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-semibold min-h-[44px] transition-colors cursor-pointer ${
            isMoreActive ? 'text-indigo-600 font-bold bg-indigo-50/70' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Menu className={`w-5 h-5 mb-0.5 ${isMoreActive ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span>Mais</span>
        </button>
      </div>

      {/* Mobile "More" Drawer / Bottom Sheet */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] z-10 max-h-[80dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  PM
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Módulos Adicionais</h3>
                  <p className="text-[11px] text-slate-500">Acesse todas as ferramentas do ateliê</p>
                </div>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 overflow-y-auto py-1">
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer min-h-[48px] ${
                      isActive 
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold' 
                        : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{tab.label}</div>
                      <div className="text-[11px] text-slate-500 truncate">{tab.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

