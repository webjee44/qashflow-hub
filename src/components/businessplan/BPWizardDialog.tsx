import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Settings, TrendingUp, Receipt, Building2, Wallet, FileCheck, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBusinessPlans, BusinessPlan } from '@/hooks/useBusinessPlans';
import { BPWizardStep1Settings } from './wizard/BPWizardStep1Settings';
import { BPWizardStep2Revenue } from './wizard/BPWizardStep2Revenue';
import { BPWizardStep3Expenses } from './wizard/BPWizardStep3Expenses';
import { BPWizardStep4Investments } from './wizard/BPWizardStep4Investments';
import { BPWizardStep5Funding } from './wizard/BPWizardStep5Funding';
import { BPWizardStep6Summary } from './wizard/BPWizardStep6Summary';
import { motion, AnimatePresence } from 'framer-motion';

interface BPWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessPlan?: BusinessPlan | null;
  mode?: 'create' | 'edit';
}

const TABS = [
  { id: 'settings', label: 'Paramètres', icon: Settings },
  { id: 'revenue', label: 'Revenus', icon: TrendingUp },
  { id: 'expenses', label: 'Charges', icon: Receipt },
  { id: 'investments', label: 'Investissements', icon: Building2 },
  { id: 'funding', label: 'Financement', icon: Wallet },
  { id: 'summary', label: 'Synthèse', icon: FileCheck },
];

export function BPWizardDialog({ open, onOpenChange, businessPlan, mode = 'create' }: BPWizardDialogProps) {
  const [activeTab, setActiveTab] = useState('settings');
  const [currentBP, setCurrentBP] = useState<BusinessPlan | null>(businessPlan || null);
  const { createBusinessPlan, updateBusinessPlan, finalizeBusinessPlan } = useBusinessPlans();

  useEffect(() => {
    if (businessPlan) {
      setCurrentBP(businessPlan);
    }
  }, [businessPlan]);

  useEffect(() => {
    if (open && mode === 'create' && !businessPlan) {
      setActiveTab('settings');
      setCurrentBP(null);
    }
  }, [open, mode, businessPlan]);

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
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === 'create' ? 'Nouveau Business Plan' : currentBP?.name || 'Business Plan'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentBP?.status === 'draft' ? 'Brouillon' : currentBP?.status === 'finalized' ? 'Finalisé' : 'Étape ' + (currentTabIndex + 1) + ' sur ' + TABS.length}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-6 bg-background">
            <TabsList className="h-14 bg-transparent gap-2">
              {TABS.map((tab, index) => {
                const Icon = tab.icon;
                const isCompleted = currentBP && index < currentTabIndex;
                const isActive = tab.id === activeTab;
                const isDisabled = !currentBP && index > 0;

                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={isDisabled}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                      data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                      ${isCompleted ? 'text-primary' : ''}
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
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
                  <BPWizardStep2Revenue />
                </TabsContent>

                <TabsContent value="expenses" className="h-full m-0 p-6">
                  <BPWizardStep3Expenses />
                </TabsContent>

                <TabsContent value="investments" className="h-full m-0 p-6">
                  <BPWizardStep4Investments />
                </TabsContent>

                <TabsContent value="funding" className="h-full m-0 p-6">
                  <BPWizardStep5Funding />
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
              Précédent
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
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleFinalize} 
                disabled={!currentBP || finalizeBusinessPlan.isPending}
                className="gap-2"
              >
                <FileCheck className="h-4 w-4" />
                Finaliser le BP
              </Button>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
