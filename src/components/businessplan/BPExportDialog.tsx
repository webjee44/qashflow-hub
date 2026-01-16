import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileText, Loader2, Building2 } from 'lucide-react';
import { useScenarios } from '@/hooks/useScenarios';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BPExportDialogProps {
  trigger?: React.ReactNode;
}

const SECTIONS = [
  { id: 'cover', label: 'Page de garde', defaultChecked: true },
  { id: 'executive_summary', label: 'Résumé exécutif', defaultChecked: true },
  { id: 'revenue', label: 'Hypothèses de revenus', defaultChecked: true },
  { id: 'expenses', label: 'Charges prévisionnelles', defaultChecked: true },
  { id: 'personnel', label: 'Charges de personnel', defaultChecked: true },
  { id: 'investments', label: 'Investissements', defaultChecked: true },
  { id: 'pnl', label: 'Compte de résultat', defaultChecked: true },
  { id: 'cash_flow', label: 'Plan de trésorerie', defaultChecked: true },
  { id: 'balance_sheet', label: 'Bilan prévisionnel', defaultChecked: true },
  { id: 'funding_plan', label: 'Plan de financement', defaultChecked: true },
  { id: 'ratios', label: 'Ratios financiers', defaultChecked: false },
  { id: 'notes', label: 'Notes et hypothèses', defaultChecked: true },
];

export function BPExportDialog({ trigger }: BPExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(
    SECTIONS.filter(s => s.defaultChecked).map(s => s.id)
  );
  const [selectedScenario, setSelectedScenario] = useState<string>('all');
  const [companyName, setCompanyName] = useState('');
  const [introText, setIntroText] = useState('');

  const { scenarios } = useScenarios();
  const { currentCompany } = useCompany();

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bp-pdf', {
        body: {
          companyId: currentCompany?.id,
          companyName: companyName || currentCompany?.name || 'Ma Société',
          sections: selectedSections,
          scenarioId: selectedScenario === 'all' ? null : selectedScenario,
          introText,
        },
      });

      if (error) throw error;

      if (data?.pdfUrl) {
        // Download the PDF
        window.open(data.pdfUrl, '_blank');
        toast.success('Business Plan exporté avec succès');
        setOpen(false);
      } else if (data?.pdfBase64) {
        // Handle base64 PDF
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${data.pdfBase64}`;
        link.download = `business-plan-${new Date().toISOString().split('T')[0]}.pdf`;
        link.click();
        toast.success('Business Plan exporté avec succès');
        setOpen(false);
      } else {
        throw new Error('Aucun PDF généré');
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Exporter le Business Plan
          </DialogTitle>
          <DialogDescription>
            Personnalisez votre export PDF professionnel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Company Info */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Informations société</Label>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="companyName" className="text-xs text-muted-foreground">
                  Nom de la société (sur la page de garde)
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={currentCompany?.name || 'Ma Société'}
                />
              </div>
              <div>
                <Label htmlFor="introText" className="text-xs text-muted-foreground">
                  Texte d'introduction (optionnel)
                </Label>
                <Textarea
                  id="introText"
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  placeholder="Décrivez brièvement votre projet..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Scenario Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Scénario à exporter</Label>
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un scénario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les scénarios (comparatif)</SelectItem>
                {scenarios.map(scenario => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sections Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sections à inclure</Label>
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {SECTIONS.map(section => (
                    <div key={section.id} className="flex items-center gap-2">
                      <Checkbox
                        id={section.id}
                        checked={selectedSections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                      <Label 
                        htmlFor={section.id} 
                        className="text-sm cursor-pointer"
                      >
                        {section.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || selectedSections.length === 0}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exporter PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
