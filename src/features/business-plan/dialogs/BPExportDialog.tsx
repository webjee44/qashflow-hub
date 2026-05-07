import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logError } from '@/lib/logger';
import { Download, FileText, Loader2, Building2, Palette, FileCheck } from 'lucide-react';
import { useScenarios } from '@/hooks/useScenarios';
import { useCompany } from '@/hooks/useCompany';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { useBPCashFlow } from '@/features/business-plan/hooks/useBPCashFlow';
import { useFundingPlan } from '@/features/business-plan/hooks/useFundingPlan';
import { useBPRatios } from '@/features/business-plan/hooks/useBPRatios';
import { useBPSettings } from '@/hooks/useBPSettings';
import { useBPModel } from '@/features/business-plan/hooks/useBPModel';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import { BPDocument } from '../pdf/BPDocument';

interface BPExportDialogProps {
  trigger?: React.ReactNode;
}

const SECTIONS = [
  { id: 'cover', label: 'Page de garde', defaultChecked: true, description: 'Page de couverture professionnelle' },
  { id: 'executive_summary', label: 'Résumé exécutif', defaultChecked: true, description: 'Synthèse des chiffres clés' },
  { id: 'revenue', label: 'Hypothèses de revenus', defaultChecked: true, description: 'Sources de revenus et projections' },
  { id: 'expenses', label: 'Charges prévisionnelles', defaultChecked: true, description: 'Charges fixes et variables' },
  { id: 'personnel', label: 'Charges de personnel', defaultChecked: true, description: 'Salariés et dirigeants' },
  { id: 'investments', label: 'Investissements', defaultChecked: true, description: 'Immobilisations et amortissements' },
  { id: 'pnl', label: 'Compte de résultat', defaultChecked: true, description: 'P&L multi-années avec ratios' },
  { id: 'cash_flow', label: 'Plan de trésorerie', defaultChecked: true, description: 'Flux de trésorerie annuels' },
  { id: 'balance_sheet', label: 'Bilan prévisionnel', defaultChecked: true, description: 'Actif et Passif' },
  { id: 'funding_plan', label: 'Plan de financement', defaultChecked: true, description: 'Emplois vs Ressources' },
  { id: 'ratios', label: 'Indicateurs financiers', defaultChecked: true, description: 'Ratios et point mort' },
  { id: 'notes', label: 'Notes et hypothèses', defaultChecked: true, description: 'Paramètres utilisés' },
];

const COLOR_PRESETS = [
  { name: 'Bleu corporate', value: { r: 30, g: 64, b: 175 } },
  { name: 'Vert nature', value: { r: 22, g: 101, b: 52 } },
  { name: 'Violet premium', value: { r: 109, g: 40, b: 217 } },
  { name: 'Orange dynamique', value: { r: 194, g: 65, b: 12 } },
  { name: 'Rouge passion', value: { r: 185, g: 28, b: 28 } },
  { name: 'Gris élégant', value: { r: 71, g: 85, b: 105 } },
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
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].value);

  const { scenarios } = useScenarios();
  const { currentCompany } = useCompany();
  const { data: plData } = useProfitLoss();
  const { data: bsData } = useBalanceSheet();
  const { data: cashFlowData } = useBPCashFlow();
  const { data: fpData } = useFundingPlan();
  const { ratios, getBreakEvenData } = useBPRatios();
  const { settings } = useBPSettings();
  const { data: bpModel } = useBPModel();

  const startYear = settings.bp_start_date ? new Date(settings.bp_start_date).getFullYear() : new Date().getFullYear();
  const years = settings.bp_years || 3;

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const selectAll = () => setSelectedSections(SECTIONS.map(s => s.id));
  const selectNone = () => setSelectedSections([]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await pdf(
        <BPDocument
          companyName={companyName || currentCompany?.name || 'Ma Société'}
          sections={selectedSections}
          introText={introText}
          primaryColor={primaryColor}
          startYear={startYear}
          years={years}
          plData={plData}
          bsData={bsData}
          fpData={fpData}
          cashFlowData={cashFlowData}
          ratios={ratios}
          getBreakEvenData={getBreakEvenData}
          settings={settings}
          validation={bpModel?.validation}
          engineVersion={bpModel?.engineVersion}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `business-plan-${(companyName || currentCompany?.name || 'export').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Business Plan exporté avec succès');
      setOpen(false);
    } catch (error: any) {
      logError('Export error:', error);
      toast.error(error.message || "Erreur lors de l'export");
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Exporter le Business Plan
          </DialogTitle>
          <DialogDescription>
            Générez un document PDF professionnel avec mise en page soignée
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Contenu
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              Société
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-2">
              <Palette className="h-4 w-4" />
              Style
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Sections à inclure</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>Tout</Button>
                    <Button variant="ghost" size="sm" onClick={selectNone}>Aucun</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {SECTIONS.map(section => (
                    <div
                      key={section.id}
                      className={`flex items-start gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                        selectedSections.includes(section.id)
                          ? 'bg-primary/5 border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleSection(section.id)}
                    >
                      <Checkbox
                        id={section.id}
                        checked={selectedSections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={section.id} className="text-sm font-medium cursor-pointer">
                          {section.label}
                        </Label>
                        <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Scénario</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un scénario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les scénarios (comparatif)</SelectItem>
                    {scenarios.map(scenario => (
                      <SelectItem key={scenario.id} value={scenario.id}>{scenario.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Informations société</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName" className="text-xs text-muted-foreground">
                    Nom de la société (page de garde)
                  </Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={currentCompany?.name || 'Ma Société'}
                    className="mt-1"
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
                    placeholder="Décrivez brièvement votre projet d'entreprise, votre vision et vos objectifs..."
                    rows={4}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ce texte apparaîtra sur la page de garde sous le nom de la société
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="style" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Couleur principale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => setPrimaryColor(preset.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        primaryColor.r === preset.value.r &&
                        primaryColor.g === preset.value.g &&
                        primaryColor.b === preset.value.b
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-md shadow-sm"
                        style={{ backgroundColor: `rgb(${preset.value.r}, ${preset.value.g}, ${preset.value.b})` }}
                      />
                      <span className="text-sm font-medium">{preset.name}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  La couleur principale est utilisée pour les titres, en-têtes de tableaux et éléments décoratifs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Aperçu du style</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: `rgb(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b})` }}
                >
                  <div className="text-white font-bold text-lg">BUSINESS PLAN</div>
                  <div className="text-white/80 text-sm mt-1">
                    {companyName || currentCompany?.name || 'Ma Société'}
                  </div>
                </div>
                <div className="mt-3 border rounded-lg overflow-hidden">
                  <div
                    className="px-3 py-2 text-white text-sm font-medium"
                    style={{ backgroundColor: `rgb(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b})` }}
                  >
                    Exemple d'en-tête de tableau
                  </div>
                  <div className="px-3 py-2 text-sm bg-muted/30">Ligne de données 1</div>
                  <div className="px-3 py-2 text-sm">Ligne de données 2</div>
                  <div className="px-3 py-2 text-sm bg-muted/30">Ligne de données 3</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              {selectedSections.length} section(s) sélectionnée(s)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                onClick={handleExport}
                disabled={isExporting || selectedSections.length === 0}
                className="gap-2 min-w-[140px]"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Exporter PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
