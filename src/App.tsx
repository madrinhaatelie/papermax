import React, { useState, useEffect } from 'react';
import { 
  Order, 
  Product, 
  MaterialItem, 
  StockMovement, 
  ProductionJob, 
  FinancialTransaction, 
  AtelierSettings 
} from './types';
import { storage } from './services/storage';
import { Sidebar, MobileHeader, ActiveTab } from './components/Sidebar';
import { DashboardView } from './modules/dashboard/DashboardView';
import { OrdersView } from './modules/orders/OrdersView';
import { ProductsView } from './modules/products/ProductsView';
import { StockView } from './modules/stock/StockView';
import { ProductionView } from './modules/production/ProductionView';
import { BulkPersonalizationView } from './modules/personalization/BulkPersonalizationView';
import { FinanceView } from './modules/finance/FinanceView';
import { CopilotView } from './modules/copilot/CopilotView';
import { SettingsView } from './modules/settings/SettingsView';
import { OrderModal } from './modules/orders/OrderModal';
import { PricingCalculatorModal } from './modules/products/PricingCalculatorModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  
  // App state loaded from persistent storage
  const [orders, setOrders] = useState<Order[]>(() => storage.getOrders());
  const [products, setProducts] = useState<Product[]>(() => storage.getProducts());
  const [materials, setMaterials] = useState<MaterialItem[]>(() => storage.getMaterials());
  const [movements, setMovements] = useState<StockMovement[]>(() => storage.getStockMovements());
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>(() => storage.getProductionJobs());
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => storage.getTransactions());
  const [settings, setSettings] = useState<AtelierSettings>(() => storage.getSettings());

  // Global modals
  const [isGlobalOrderModalOpen, setIsGlobalOrderModalOpen] = useState(false);
  const [selectedOrderToEdit, setSelectedOrderToEdit] = useState<Order | null>(null);
  const [isGlobalPricingModalOpen, setIsGlobalPricingModalOpen] = useState(false);

  // Orders handlers
  const handleSaveOrder = (savedOrder: Order) => {
    storage.saveOrder(savedOrder);
    setOrders(storage.getOrders());

    // If order was created/updated with payment amount, record transaction if new
    if (savedOrder.amountPaid > 0) {
      const existingTrans = transactions.find(t => t.orderId === savedOrder.id);
      if (!existingTrans) {
        const trans: FinancialTransaction = {
          id: 'trans_' + Date.now(),
          description: `Recebimento Pedido ${savedOrder.orderNumber} (${savedOrder.customerName})`,
          type: 'income',
          category: savedOrder.paymentStatus === 'paid' ? 'venda_produtos' : 'sinal_pedido',
          amount: savedOrder.amountPaid,
          date: new Date().toISOString().split('T')[0],
          paymentMethod: savedOrder.paymentMethod,
          orderId: savedOrder.id,
          customerOrSupplier: savedOrder.customerName,
          status: 'completed'
        };
        storage.saveTransaction(trans);
        setTransactions(storage.getTransactions());
      }
    }

    // If order moved to production, auto-create production jobs for items if not present
    if (savedOrder.status === 'in_production') {
      const existingJobs = productionJobs.filter(j => j.orderId === savedOrder.id);
      if (existingJobs.length === 0) {
        savedOrder.items.forEach((item, idx) => {
          const newJob: ProductionJob = {
            id: 'job_' + Date.now() + '_' + idx,
            orderId: savedOrder.id,
            orderNumber: savedOrder.orderNumber,
            customerName: savedOrder.customerName,
            productName: item.productName,
            theme: item.theme,
            quantity: item.quantity,
            machine: 'plotter_corte',
            step: 'impressao',
            priority: 'normal',
            estimatedMinutes: 20 * item.quantity,
            assignedTo: 'Equipe de Produção',
            deadline: savedOrder.deliveryDeadline.split('T')[0]
          };
          storage.saveProductionJob(newJob);
        });
        setProductionJobs(storage.getProductionJobs());
      }
    }
  };

  const handleDeleteOrder = (id: string) => {
    storage.deleteOrder(id);
    setOrders(storage.getOrders());
  };

  // Products handlers
  const handleSaveProduct = (product: Product) => {
    storage.saveProduct(product);
    setProducts(storage.getProducts());
  };

  const handleDeleteProduct = (id: string) => {
    storage.deleteProduct(id);
    setProducts(storage.getProducts());
  };

  // Materials & Stock Handlers
  const handleSaveMaterial = (material: MaterialItem) => {
    storage.saveMaterial(material);
    setMaterials(storage.getMaterials());
  };

  const handleDeleteMaterial = (id: string) => {
    storage.deleteMaterial(id);
    setMaterials(storage.getMaterials());
  };

  const handleSaveStockMovement = (movement: Omit<StockMovement, 'id' | 'date'>) => {
    storage.addStockMovement(movement);
    
    // Update material current stock
    const mat = materials.find(m => m.id === movement.materialId);
    if (mat) {
      const updatedMat: MaterialItem = {
        ...mat,
        currentStock: movement.newStock,
        lastRestocked: movement.type === 'in' ? new Date().toISOString().split('T')[0] : mat.lastRestocked
      };
      storage.saveMaterial(updatedMat);
      setMaterials(storage.getMaterials());
    }
    setMovements(storage.getStockMovements());
  };

  // Production handlers
  const handleSaveProductionJob = (job: ProductionJob) => {
    storage.saveProductionJob(job);
    setProductionJobs(storage.getProductionJobs());
  };

  const handleDeleteProductionJob = (id: string) => {
    storage.deleteProductionJob(id);
    setProductionJobs(storage.getProductionJobs());
  };

  // Financial handlers
  const handleSaveTransaction = (transaction: FinancialTransaction) => {
    storage.saveTransaction(transaction);
    setTransactions(storage.getTransactions());
  };

  const handleDeleteTransaction = (id: string) => {
    storage.deleteTransaction(id);
    setTransactions(storage.getTransactions());
  };

  // Settings & Backup
  const handleSaveSettings = (newSettings: AtelierSettings) => {
    storage.saveSettings(newSettings);
    setSettings(storage.getSettings());
  };

  const handleExportBackup = () => {
    const jsonStr = storage.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_papermax_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonStr: string) => {
    const ok = storage.importFullBackup(jsonStr);
    if (ok) {
      setOrders(storage.getOrders());
      setProducts(storage.getProducts());
      setMaterials(storage.getMaterials());
      setMovements(storage.getStockMovements());
      setProductionJobs(storage.getProductionJobs());
      setTransactions(storage.getTransactions());
      setSettings(storage.getSettings());
      alert('Backup restaurado com sucesso!');
    } else {
      alert('Erro ao importar arquivo de backup JSON inválido.');
    }
  };

  const handleResetSeed = () => {
    storage.resetToDefaultSeed();
    setOrders(storage.getOrders());
    setProducts(storage.getProducts());
    setMaterials(storage.getMaterials());
    setMovements(storage.getStockMovements());
    setProductionJobs(storage.getProductionJobs());
    setTransactions(storage.getTransactions());
    setSettings(storage.getSettings());
    alert('Dados de demonstração restaurados com sucesso!');
  };

  // Critical stock alert count for contextual badge
  const criticalStockCount = materials.filter(m => m.currentStock <= m.minStock).length;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        criticalStockCount={criticalStockCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        {/* Top Navbar */}
        <header className="h-14 sm:h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md px-3 sm:px-6 pt-[env(safe-area-inset-top,0px)] flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0">
              PM
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">{settings.name}</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block truncate">{settings.slogan}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setIsGlobalPricingModalOpen(true)}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 shadow-xs hidden sm:flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              Calculadora de Preço
            </button>
            <button
              onClick={() => {
                setSelectedOrderToEdit(null);
                setIsGlobalOrderModalOpen(true);
              }}
              className="text-xs font-bold text-white px-3 sm:px-3.5 py-1.5 sm:py-1.5 min-h-[36px] rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              + Novo Pedido
            </button>
          </div>
        </header>

        {/* View Router */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={orders}
              materials={materials}
              productionJobs={productionJobs}
              transactions={transactions}
              settings={settings}
              onOpenNewOrder={() => {
                setSelectedOrderToEdit(null);
                setIsGlobalOrderModalOpen(true);
              }}
              onOpenPricingCalculator={() => setIsGlobalPricingModalOpen(true)}
              onSelectOrder={(order) => {
                setSelectedOrderToEdit(order);
                setActiveTab('orders');
              }}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={orders}
              products={products}
              settings={settings}
              onSaveOrder={handleSaveOrder}
              onDeleteOrder={handleDeleteOrder}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              materials={materials}
              settings={settings}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {activeTab === 'stock' && (
            <StockView
              materials={materials}
              movements={movements}
              onSaveMaterial={handleSaveMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onSaveMovement={handleSaveStockMovement}
            />
          )}

          {activeTab === 'production' && (
            <ProductionView
              productionJobs={productionJobs}
              orders={orders}
              onSaveJob={handleSaveProductionJob}
              onDeleteJob={handleDeleteProductionJob}
            />
          )}

          {activeTab === 'personalization' && (
            <BulkPersonalizationView settings={settings} />
          )}

          {activeTab === 'finance' && (
            <FinanceView
              transactions={transactions}
              orders={orders}
              onSaveTransaction={handleSaveTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'copilot' && (
            <CopilotView
              settings={settings}
              orders={orders}
              products={products}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onResetSeed={handleResetSeed}
            />
          )}
        </div>

        {/* Global Modals */}
        <OrderModal
          isOpen={isGlobalOrderModalOpen}
          onClose={() => {
            setIsGlobalOrderModalOpen(false);
            setSelectedOrderToEdit(null);
          }}
          onSave={handleSaveOrder}
          orderToEdit={selectedOrderToEdit}
          products={products}
        />

        <PricingCalculatorModal
          isOpen={isGlobalPricingModalOpen}
          onClose={() => setIsGlobalPricingModalOpen(false)}
          settings={settings}
        />
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileHeader activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};
