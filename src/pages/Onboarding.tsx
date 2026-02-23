import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, ArrowRight, ArrowLeft, Building2, Landmark, Shield, CheckCircle2, Search, Lock, Eye, EyeOff, ChevronDown, HelpCircle, TrendingUp, Zap, BarChart3, Rocket, LayoutDashboard, ArrowLeftRight, Tags, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { logError, logDebug } from '@/lib/logger';
import logo from '@/assets/logo.png';
import bridgeLogo from '@/assets/bridge-logo.jpg';

// ─── Country codes ───────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+377', flag: '🇲🇨', name: 'Monaco' },
  { code: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, session, loading: authLoading } = useAuth();
  const { companies } = useCompany();
  const bridgeCallbackHandled = useRef(false);

  const [step, setStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingBridge, setIsConnectingBridge] = useState(false);
  const [isInvitedUser, setIsInvitedUser] = useState(false);
  const [countryCode, setCountryCode] = useState('+33');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

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
  // BUT skip if we're handling a bridge callback (to avoid race condition)
  useEffect(() => {
    if (authLoading) return;
    // If bridge callback is present, let the bridge effect handle completion
    if (searchParams.get('bridge_callback') === 'success') return;
    
    if (!user) {
      navigate('/sign-in');
      return;
    }
    const checkProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();
      if (data?.onboarding_completed === true) {
        navigate('/dashboard', { replace: true });
        return;
      }
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id);
      if (memberships && memberships.length > 0 && !memberships.some(m => m.role === 'owner')) {
        setIsInvitedUser(true);
      }
    };
    checkProfile();
  }, [user, authLoading, navigate, searchParams]);

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

  // Handle Bridge callback — must wait for auth to load
  useEffect(() => {
    if (authLoading) return;
    if (searchParams.get('bridge_callback') !== 'success') return;
    if (!user) {
      navigate('/sign-in');
      return;
    }
    if (bridgeCallbackHandled.current) return;
    bridgeCallbackHandled.current = true;

    localStorage.setItem('bridgePendingSync', 'true');
    // Clean up URL params
    setSearchParams({}, { replace: true });
    handleComplete();
  }, [searchParams, user, authLoading]);

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
          phone: phone ? `${countryCode} ${phone}` : null,
          onboarding_step: 1,
        } as any)
        .eq('id', user.id);
      if (error) throw error;
      // Invited users skip steps 2 & 3 — go directly to dashboard
      if (isInvitedUser) {
        await handleComplete();
        return;
      }
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

  const autoAssignBankAccounts = async (companyId: string) => {
    try {
      // Fetch all bridge accounts for this company
      const { data: bridgeAccounts, error: fetchError } = await supabase
        .from('bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', companyId);

      if (fetchError || !bridgeAccounts?.length) return;

      // Check existing assignments
      const { data: existing } = await supabase
        .from('company_bridge_accounts')
        .select('bridge_account_id')
        .eq('company_id', companyId);

      const existingIds = new Set((existing || []).map(e => e.bridge_account_id));
      const newAssignments = bridgeAccounts
        .filter(a => !existingIds.has(a.bridge_account_id))
        .map(a => ({ company_id: companyId, bridge_account_id: a.bridge_account_id }));

      if (newAssignments.length > 0) {
        await supabase.from('company_bridge_accounts').insert(newAssignments);
      }

      // Update company balance & count
      const { data: allAccounts } = await supabase
        .from('bridge_accounts')
        .select('balance')
        .eq('company_id', companyId);

      const totalBalance = (allAccounts || []).reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
      await supabase
        .from('companies')
        .update({
          bridge_accounts_count: allAccounts?.length || 0,
          bank_balance: totalBalance,
          bank_balance_updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      logDebug('Auto-assigned bank accounts to company', { companyId, count: newAssignments.length });
    } catch (err) {
      logError('Auto-assign bank accounts error:', err);
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
      localStorage.setItem('show-welcome-guide', 'true');
      // Clear sync cooldown so auto-sync triggers immediately on /transactions
      localStorage.removeItem('bridge_last_auto_sync');

      // Auto-assign bank accounts if user has only one company
      const { data: userCompanies } = await supabase
        .from('companies')
        .select('id')
        .is('deleted_at', null);

      if (userCompanies?.length === 1) {
        await autoAssignBankAccounts(userCompanies[0].id);
      }

      // Invalidate all cached data so the app fetches fresh state
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({ queryKey: ['bank_balance'] });
      await queryClient.invalidateQueries({ queryKey: ['bridge_accounts'] });

      // Show celebration screen
      setShowCelebration(true);

      // Fire confetti
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
          confetti({ particleCount: 50, spread: 100, origin: { y: 0.5, x: 0.3 } });
        }, 300);
        setTimeout(() => {
          confetti({ particleCount: 50, spread: 100, origin: { y: 0.5, x: 0.7 } });
        }, 500);
      }, 200);

      // Auto-redirect after 4 seconds
      setTimeout(() => {
        navigate('/transactions', { replace: true });
      }, 4500);
    } catch (err) {
      logError('Complete onboarding error:', err);
      navigate('/transactions', { replace: true });
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

      window.location.href = connectData.connect_url;
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

  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // ─── Celebration Screen ───────────────────────────────────────────────────
  if (showCelebration) {
    const firstName_ = firstName || user?.user_metadata?.first_name || '';
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
          >
            <Rocket className="w-10 h-10 text-primary" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-bold text-foreground mb-3"
          >
            {firstName_ ? `Bienvenue ${firstName_} !` : 'Bienvenue !'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground mb-8"
          >
            Votre espace est prêt. Découvrez vos outils pour piloter votre trésorerie.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-2 gap-3 mb-8"
          >
            {[
              { icon: LayoutDashboard, label: 'Tableau de bord' },
              { icon: ArrowLeftRight, label: 'Transactions' },
              { icon: TrendingUp, label: 'Prévisions' },
              { icon: Tags, label: 'Catégories' },
            ].map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.1 }}
                className="flex items-center gap-2.5 rounded-lg border border-border p-3"
              >
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <Button
              onClick={() => navigate('/transactions', { replace: true })}
              className="h-12 px-8 gap-2"
            >
              C'est parti
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-xs text-muted-foreground mt-4"
          >
            Redirection automatique dans quelques secondes…
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-6 py-5">
        <img src={logo} alt="Qashflow" className="h-8" />
        <StepIndicator current={step} total={isInvitedUser ? 1 : 3} />
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
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCountryOpen(!countryOpen)}
                        className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors min-w-[90px]"
                      >
                        <span className="text-base leading-none">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                        <span className="text-foreground font-medium">{countryCode}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </button>
                      {countryOpen && (
                        <div className="absolute z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                          <div className="p-2 border-b border-border">
                            <Input
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Rechercher..."
                              className="h-8 text-sm"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {COUNTRY_CODES
                              .filter(c => 
                                countrySearch === '' || 
                                c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                c.code.includes(countrySearch)
                              )
                              .map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setCountryCode(c.code);
                                    setCountryOpen(false);
                                    setCountrySearch('');
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors ${
                                    c.code === countryCode ? 'bg-accent' : ''
                                  }`}
                                >
                                  <span className="text-base leading-none">{c.flag}</span>
                                  <span className="text-foreground">{c.name}</span>
                                  <span className="text-muted-foreground ml-auto">{c.code}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="6 12 34 56 78"
                      className="flex-1"
                    />
                  </div>
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
              className="w-full max-w-lg"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Landmark className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Connecter ma banque
                </h1>
                <p className="text-muted-foreground">
                  Synchronisez automatiquement vos comptes bancaires pour un suivi en temps réel
                </p>
              </div>

              <div className="space-y-5">
                {/* Connection CTA */}
                <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                  <Button
                    onClick={handleConnectBridge}
                    disabled={isConnectingBridge}
                    className="h-12 px-8 text-base font-semibold w-full"
                  >
                    {isConnectingBridge ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Landmark className="w-5 h-5 mr-2" />
                    )}
                    Connecter ma banque en toute sécurité
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Connexion sécurisée via Bridge · Audits de sécurité trimestriels
                  </p>
                </div>

                {/* Powered by Bridge */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Propulsé par</span>
                  <img src={bridgeLogo} alt="Bridge" className="h-12 rounded" />
                </div>

                {/* Security trust badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
                    <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Agréé ACPR</p>
                      <p className="text-xs text-muted-foreground">Établissement de paiement contrôlé par la Banque de France</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Conforme RGPD</p>
                      <p className="text-xs text-muted-foreground">Données protégées selon la réglementation européenne</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
                    <Lock className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Chiffrement AES-256</p>
                      <p className="text-xs text-muted-foreground">Données chiffrées au repos et en transit via TLS 1.2</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
                    <EyeOff className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Lecture seule</p>
                      <p className="text-xs text-muted-foreground">Aucun accès à vos identifiants, jamais stockés</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="h-12"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                        <HelpCircle className="w-4 h-4" />
                        Pourquoi connecter ma banque ?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-xl">Pourquoi connecter ma banque ?</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Zap className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Import automatique</p>
                            <p className="text-xs text-muted-foreground">Vos transactions sont synchronisées chaque jour, sans saisie manuelle.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Prévisions fiables</p>
                            <p className="text-xs text-muted-foreground">Des prévisions de trésorerie basées sur vos flux réels, pas des estimations.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BarChart3 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Vision en temps réel</p>
                            <p className="text-xs text-muted-foreground">Votre solde et vos flux mis à jour automatiquement, en un coup d'œil.</p>
                          </div>
                        </div>

                        <div className="border-t border-border pt-4 space-y-2.5">
                          <p className="text-xs font-medium text-foreground">🔒 Sécurité garantie</p>
                          <div className="grid grid-cols-2 gap-2">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Agréé ACPR</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Conforme RGPD</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Chiffrement AES-256</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><EyeOff className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> Lecture seule</p>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
