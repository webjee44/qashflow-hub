import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { logError } from '@/lib/logger';

export default function Start() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Format as XX XX XX XX XX
    const formatted = digits.match(/.{1,2}/g)?.join(' ') || digits;
    return formatted.slice(0, 14); // Max 10 digits with spaces
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPhone = phone.replace(/\s/g, '');
    if (cleanPhone.length < 9) {
      toast({
        title: "Numéro invalide",
        description: "Veuillez entrer un numéro de téléphone valide",
        variant: "destructive"
      });
      return;
    }

    if (!companyName.trim()) {
      toast({
        title: "Société requise",
        description: "Veuillez entrer le nom de votre société",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const fullPhone = `+33${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}`;
      
      // Store in session for verification page
      sessionStorage.setItem('onboarding_phone', fullPhone);
      sessionStorage.setItem('onboarding_company', companyName);

      // Send OTP via Supabase
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Code envoyé !",
        description: `Un SMS a été envoyé au ${fullPhone}`,
      });

      navigate('/start/verify');
    } catch (error: any) {
      logError('Error sending OTP:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le code SMS",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col items-center justify-center p-6">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-8"
        >
          <img src={logo} alt="Qashflow" className="h-12 brightness-0 invert" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Démarrez votre essai gratuit
          </h1>
          <p className="text-slate-400">
            Prenez le contrôle de votre trésorerie en 2 minutes
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Phone input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-300">
              Numéro de téléphone
            </Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400">
                <span className="text-lg">🇫🇷</span>
                <span className="text-sm font-medium">+33</span>
              </div>
              <Input
                id="phone"
                type="tel"
                placeholder="6 12 34 56 78"
                value={phone}
                onChange={handlePhoneChange}
                className="pl-20 h-14 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
              />
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            </div>
          </div>

          {/* Company input */}
          <div className="space-y-2">
            <Label htmlFor="company" className="text-slate-300">
              Nom de votre société
            </Label>
            <div className="relative">
              <Input
                id="company"
                type="text"
                placeholder="Ma Super Entreprise"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="pl-4 pr-10 h-14 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
              />
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-lg shadow-lg shadow-cyan-500/25 transition-all duration-300"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Recevoir mon code
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </motion.form>

        {/* Login link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-8 text-slate-400"
        >
          Déjà un compte ?{' '}
          <button
            onClick={() => navigate('/auth')}
            className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Connexion
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}
