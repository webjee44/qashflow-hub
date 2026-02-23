import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, ArrowRight, ArrowLeft, Building2, Landmark, Shield, CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { logError, logDebug } from '@/lib/logger';
import logo from '@/assets/logo.png';

// ─── Constants ───────────────────────────────────────────────────────────────

const JOB_TITLES = [
  'Dirigeant / CEO / Gérant',
  'DAF / RAF',
  'Finance / Comptabilité / Contrôle de Gestion',
  'Expert-Comptable',
  'Assistant / Office Manager / Secrétaire',
  'Manager / Responsable (hors fonction finance)',
  'Freelance / Auto-Entrepreneur',
  'Autre',
];

const ACTIVITY_TYPES = [
  'Commerçants',
  'Artisans',
  'Professions libérales',
  'Services / Conseil',
  'Industrie / Production',
  'Tech / Startup',
  'BTP / Construction',
  'Restauration / Hôtellerie',
  'Autre',
];

const REVENUE_RANGES = [
  'Moins de 50 000 €',
  'De 50 000 à 250 000 €',
  'De 250 000 à 1 000 000 €',
  'De 1 000 000 à 5 000 000 €',
  'Plus de 5 000 000 €',
];

const ENTITY_COUNTS = [
  'Une seule',
  '2 à 3',
  '4 à 10',
  'Plus de 10',
];

// ─── SIRENE API types ────────────────────────────────────────────────────────

interface SireneResult {
  siren: string;
  nom_complet: string;
  nom_raison_sociale: string;
  siege: {
    code_postal: string;
    libelle_commune: string;
    activite_principale: string;
  };
  nombre_etablissements: number;
  categorie_entreprise: string;
  tranche_effectif_salarie: string;
  nature_juridique: string;
}

// ─── Company Search Component ────────────────────────────────────────────────

function CompanySearchInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: SireneResult) => void;
}) {
  const [results, setResults] = useState<SireneResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const searchSirene = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=8`
      );
      const data = await res.json();
      setResults(data.results || []);
      setShowResults(true);
    } catch (err) {
      logError('SIRENE search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSirene(val), 300);
  };

  const handleSelect = (result: SireneResult) => {
    onChange(result.nom_complet);
    setShowResults(false);
    onSelect(result);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Tapez le nom de votre entreprise..."
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          >
            <Command className="bg-transparent">
              <CommandList className="max-h-[280px]">
                <CommandGroup>
                  {results.map((r) => (
                    <CommandItem
                      key={r.siren}
                      value={r.siren}
                      onSelect={() => handleSelect(r)}
                      className="flex flex-col items-start gap-0.5 py-2.5 px-3 cursor-pointer"
                    >
                      <span className="font-medium text-sm text-foreground">
                        {r.nom_complet}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        SIREN {r.siren}
                        {r.siege?.code_postal && ` · ${r.siege.code_postal} ${r.siege.libelle_commune}`}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </motion.div>
        )}
      </AnimatePresence>

      {showResults && results.length === 0 && value.length >= 2 && !isSearching && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg p-3"
        >
          <p className="text-sm text-muted-foreground text-center">
            Aucune entreprise trouvée
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Progress Indicator ──────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-primary w-8'
              : i === current
              ? 'bg-primary/60 w-6'
              : 'bg-muted w-4'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Onboarding Page ────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const { companies } = useCompany();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingBridge, setIsConnectingBridge] = useState(false);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 fields
  const [companyName, setCompanyName] = useState('');
  const [selectedSiren, setSelectedSiren] = useState('');
  const [activityType, setActivityType] = useState('');
  const [revenueRange, setRevenueRange] = useState('');
  const [entityCount, setEntityCount] = useState('');

  // Redirect if not authenticated or onboarding already completed
  useEffect(() => {
    if (!user) {
      navigate('/sign-in');
      return;
    }
    // Check if onboarding already completed
    const checkCompleted = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();
      if (data?.onboarding_completed === true) {
        navigate('/dashboard', { replace: true });
      }
    };
    checkCompleted();
  }, [user, navigate]);

  // Load existing profile data to resume
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) {
        const p = data as any;
        if (p.first_name) setFirstName(p.first_name);
        if (p.last_name) setLastName(p.last_name);
        if (p.job_title) setJobTitle(p.job_title);
        if (p.phone) setPhone(p.phone);
        if (p.company_activity_type) setActivityType(p.company_activity_type);
        if (p.company_revenue_range) setRevenueRange(p.company_revenue_range);
        if (p.company_entity_count) setEntityCount(p.company_entity_count);
        // Resume at the right step
        if (p.onboarding_step && p.onboarding_step > 0) {
          setStep(Math.min(p.onboarding_step, 2));
        }
      }
    };
    loadProfile();
  }, [user]);

  // Load company name
  useEffect(() => {
    if (companies.length > 0 && !companyName) {
      const defaultCo = companies.find((c) => c.is_default) || companies[0];
      if (defaultCo?.name && defaultCo.name !== 'Mon entreprise') {
        setCompanyName(defaultCo.name);
      }
    }
  }, [companies]);

  // Handle Bridge callback
  useEffect(() => {
    if (searchParams.get('bridge_callback') === 'success') {
      localStorage.setItem('bridgePendingSync', 'true');
      handleComplete();
    }
  }, [searchParams]);

  // ─── Save Helpers ────────────────────────────────────────────────────────

  const saveStep1 = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName || null,
          job_title: jobTitle || null,
          phone: phone || null,
          onboarding_step: 1,
        } as any)
        .eq('id', user.id);
      if (error) throw error;
      setStep(1);
    } catch (err) {
      logError('Save step 1 error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveStep2 = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_activity_type: activityType || null,
          company_revenue_range: revenueRange || null,
          company_entity_count: entityCount || null,
          onboarding_step: 2,
        } as any)
        .eq('id', user.id);
      if (profileError) throw profileError;

      // Update company name if changed
      if (companyName) {
        const defaultCo = companies.find((c) => c.is_default) || companies[0];
        if (defaultCo) {
          await supabase
            .from('companies')
            .update({ name: companyName })
            .eq('id', defaultCo.id);
        }
      }

      setStep(2);
    } catch (err) {
      logError('Save step 2 error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_step: 3,
        } as any)
        .eq('id', user.id);
      navigate('/dashboard');
    } catch (err) {
      logError('Complete onboarding error:', err);
      navigate('/dashboard');
    }
  };

  const handleConnectBridge = async () => {
    setIsConnectingBridge(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        toast.error('Session expirée');
        return;
      }

      // Get or create Bridge user
      const { data: freshCompanies } = await supabase
        .from('companies')
        .select('id, bridge_user_uuid')
        .or('deleted_at.is.null');

      let bridgeUserUuid = freshCompanies?.find((c) => c.bridge_user_uuid)?.bridge_user_uuid || null;

      if (!bridgeUserUuid) {
        const { data: createData, error: createError } = await supabase.functions.invoke('bridge-auth', {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
          body: { action: 'create-user' },
        });
        if (createError || !createData?.success) {
          toast.error(createData?.error || 'Erreur de connexion bancaire');
          return;
        }
        bridgeUserUuid = createData.user.uuid;

        const targetCompanyId = freshCompanies?.[0]?.id || companies[0]?.id;
        if (targetCompanyId) {
          await supabase
            .from('companies')
            .update({ bridge_user_uuid: bridgeUserUuid })
            .eq('id', targetCompanyId);
        }
      }

      const redirectUrl = `${window.location.origin}/onboarding?bridge_callback=success`;

      const { data: connectData, error: connectError } = await supabase.functions.invoke('bridge-connect', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
        body: {
          bridge_user_uuid: bridgeUserUuid,
          redirect_url: redirectUrl,
        },
      });

      if (connectError || !connectData?.success) {
        toast.error(connectData?.error || 'Erreur de connexion bancaire');
        return;
      }

      // Save progress before redirecting
      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarding_step: 2 } as any)
          .eq('id', user.id);
      }

      window.location.href = connectData.redirect_url;
    } catch (err) {
      logError('Bridge connect error:', err);
      toast.error('Erreur de connexion bancaire');
    } finally {
      setIsConnectingBridge(false);
    }
  };

  const handleSireneSelect = (result: SireneResult) => {
    setCompanyName(result.nom_complet);
    setSelectedSiren(result.siren);
    // Auto-fill activity type if possible
    logDebug('SIRENE selected:', result);
  };

  if (!user) return null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-6 py-5">
        <img src={logo} alt="Qashflow" className="h-8" />
        <StepIndicator current={step} total={3} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center w-full px-4 pb-12">
        <AnimatePresence mode="wait">
          {/* ─── Step 1: Personal Info ─── */}
          {step === 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Finaliser mon inscription
                </h1>
                <p className="text-muted-foreground">
                  Quelques informations pour personnaliser votre expérience
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Prénom</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Pierre"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Nom</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Martin"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Fonction principale</Label>
                  <Select value={jobTitle} onValueChange={setJobTitle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez votre fonction" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TITLES.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Téléphone</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <Button
                  onClick={saveStep1}
                  disabled={isSubmitting || !firstName}
                  className="w-full h-12 text-base font-semibold mt-4"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Company Info ─── */}
          {step === 1 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Informations sur mon entreprise
                </h1>
                <p className="text-muted-foreground">
                  Nous adaptons l'outil à votre activité
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Nom de l'entreprise</Label>
                  <CompanySearchInput
                    value={companyName}
                    onChange={setCompanyName}
                    onSelect={handleSireneSelect}
                  />
                  {selectedSiren && (
                    <p className="text-xs text-muted-foreground">
                      SIREN : {selectedSiren}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Type d'activité</Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez votre activité" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Chiffre d'affaires annuel</Label>
                  <Select value={revenueRange} onValueChange={setRevenueRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une tranche" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVENUE_RANGES.map((range) => (
                        <SelectItem key={range} value={range}>
                          {range}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Nombre d'entités</Label>
                  <Select value={entityCount} onValueChange={setEntityCount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Combien d'entités ?" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_COUNTS.map((count) => (
                        <SelectItem key={count} value={count}>
                          {count}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(0)}
                    className="h-12"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={saveStep2}
                    disabled={isSubmitting || !companyName}
                    className="flex-1 h-12 text-base font-semibold"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Continuer
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Step 3: Bank Connection ─── */}
          {step === 2 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Landmark className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Connecter ma banque
                </h1>
                <p className="text-muted-foreground">
                  Synchronisez automatiquement vos comptes bancaires pour un suivi en temps réel
                </p>
              </div>

              <div className="space-y-6">
                {/* Security badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>100% conforme RGPD</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Agrégateurs certifiés ACPR</span>
                  </div>
                </div>

                {/* Connection area */}
                <div className="border border-dashed border-border rounded-xl p-8 text-center bg-muted/30">
                  <Landmark className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Connexion sécurisée via nos partenaires certifiés.
                    <br />
                    Vos identifiants ne sont jamais stockés.
                  </p>
                  <Button
                    onClick={handleConnectBridge}
                    disabled={isConnectingBridge}
                    className="h-12 px-6 text-base font-semibold"
                  >
                    {isConnectingBridge ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Landmark className="w-4 h-4 mr-2" />
                    )}
                    + Ajouter une banque
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="h-12"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleComplete}
                    className="flex-1 h-12 text-base text-muted-foreground hover:text-foreground"
                  >
                    Passer cette étape
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
