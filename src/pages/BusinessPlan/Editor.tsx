import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Settings, TrendingUp, Receipt, Building2, Wallet, FileCheck, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useBusinessPlans, BusinessPlan } from '@/hooks/useBusinessPlans';
import { BPWizardStep1Settings } from '@/components/businessplan/wizard/BPWizardStep1Settings';
import { BPWizardStep2Revenue } from '@/components/businessplan/wizard/BPWizardStep2Revenue';
import { BPWizardStep3Expenses } from '@/components/businessplan/wizard/BPWizardStep3Expenses';
import { BPWizardStep4Investments } from '@/components/businessplan/wizard/BPWizardStep4Investments';
import { BPWizardStep5Funding } from '@/components/businessplan/wizard/BPWizardStep5Funding';
import { BPWizardStep6Summary } from '@/components/businessplan/wizard/BPWizardStep6Summary';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { id: 'settings', label: 'Paramètres', icon: Settings },
  { id: 'revenue', label: 'Revenus', icon: TrendingUp },
  { id: 'expenses', label: 'Charges', icon: Receipt },
  { id: 'investments', label: 'Investissements', icon: Building2 },
  { id: 'funding', label: 'Financement', icon: Wallet },
  { id: 'summary', label: 'Synthèse', icon: FileCheck },
];

export default function BPEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'settings';
  
  // 'new' means creating a new BP, otherwise it's an existing BP id
  const isNewMode = id === 'new';
  const businessPlanIdParam = isNewMode ? undefined : id;
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentBP, setCurrentBP] = useState<BusinessPlan | null>(null);
  const { businessPlans, isLoading, finalizeBusinessPlan } = useBusinessPlans();

  const isEditMode = !!businessPlanIdParam;

  // Load existing BP if editing
  useEffect(() => {
    if (businessPlanIdParam && businessPlans.length > 0) {
      const bp = businessPlans.find(b => b.id === businessPlanIdParam);
      if (bp) {
        setCurrentBP(bp);
      }
    }
  }, [businessPlanIdParam, businessPlans]);

  const currentTabIndex = TABS.findIndex(t => t.id === activeTab);
  const canGoNext = currentTabIndex < TABS.length - 1;
  const canGoPrev = currentTabIndex > 0;

  const handleNext = () => {
    if (canGoNext) {
      setActiveTab(TABS[currentTabIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setActiveTab(TABS[currentTabIndex - 1].id);
    }
  };

  const handleBPCreated = (bp: BusinessPlan) => {
    setCurrentBP(bp);
    // Update URL to include the new BP id
    navigate(`/bp/editor/${bp.id}`, { replace: true });
    handleNext();
  };

  const handleBPUpdated = (updates: Partial<BusinessPlan>) => {
    if (currentBP) {
      setCurrentBP({ ...currentBP, ...updates });
    }
  };

  const handleFinalize = async () => {
    if (currentBP) {
      await finalizeBusinessPlan.mutateAsync(currentBP.id);
      navigate('/bp');
    }
  };

  const handleBack = () => {
    navigate('/bp');
  };

  if (isLoading && isEditMode) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">
              {!currentBP ? 'Nouveau Business Plan' : currentBP.name || 'Business Plan'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentBP?.status === 'draft' ? 'Brouillon' : currentBP?.status === 'finalized' ? 'Finalisé' : 'Étape ' + (currentTabIndex + 1) + ' sur ' + TABS.length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 bg-background overflow-x-auto">
          <TabsList className="h-14 bg-transparent gap-1 sm:gap-2 min-w-max">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isCompleted = currentBP && index < currentTabIndex;
              const isDisabled = !currentBP && index > 0;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={isDisabled}
                  className={`
                    flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all
                    data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                    ${isCompleted ? 'text-primary' : ''}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                  {isCompleted && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <TabsContent value="settings" className="h-full m-0 p-6">
                <BPWizardStep1Settings
                  businessPlan={currentBP}
                  onCreated={handleBPCreated}
                  onUpdated={handleBPUpdated}
                />
              </TabsContent>

              <TabsContent value="revenue" className="h-full m-0 p-6">
                <BPWizardStep2Revenue businessPlanId={currentBP?.id} />
              </TabsContent>

              <TabsContent value="expenses" className="h-full m-0 p-6">
                <BPWizardStep3Expenses businessPlanId={currentBP?.id} />
              </TabsContent>

              <TabsContent value="investments" className="h-full m-0 p-6">
                <BPWizardStep4Investments businessPlanId={currentBP?.id} />
              </TabsContent>

              <TabsContent value="funding" className="h-full m-0 p-6">
                <BPWizardStep5Funding businessPlanId={currentBP?.id} />
              </TabsContent>

              <TabsContent value="summary" className="h-full m-0 p-6">
                <BPWizardStep6Summary 
                  businessPlan={currentBP} 
                  onFinalize={handleFinalize}
                  isLoading={finalizeBusinessPlan.isPending}
                />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={!canGoPrev}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Précédent</span>
          </Button>

          <div className="flex items-center gap-2">
            {TABS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentTabIndex
                    ? 'bg-primary'
                    : index < currentTabIndex
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {canGoNext ? (
            <Button onClick={handleNext} disabled={!currentBP} className="gap-2">
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleFinalize} 
              disabled={!currentBP || finalizeBusinessPlan.isPending}
              className="gap-2"
            >
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Finaliser</span>
            </Button>
          )}
        </div>
      </Tabs>
    </div>
  );
}
