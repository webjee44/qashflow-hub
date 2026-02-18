import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { logError } from '@/lib/logger';

export default function StartVerify() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const phone = sessionStorage.getItem('onboarding_phone');
  const companyName = sessionStorage.getItem('onboarding_company');

  // Redirect if no phone stored
  useEffect(() => {
    if (!phone) {
      navigate('/start');
    }
  }, [phone, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
  }, [code]);

  const maskPhone = (phoneNumber: string) => {
    if (!phoneNumber) return '';
    // Show first 4 and last 2 digits
    return phoneNumber.slice(0, 7) + ' ** ** ' + phoneNumber.slice(-2);
  };

  const handleVerify = async () => {
    if (code.length !== 6 || !phone) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        throw error;
      }

      // Update profile with company name and phone
      // Note: Company is already created by the handle_new_user trigger
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          phone,
          onboarding_completed: false,
          onboarding_step: 0,
          // Default: keep Treasury accessible (BP-only should be an explicit choice)
          bp_enabled: false,
        });
      }

      // Clear session storage
      sessionStorage.removeItem('onboarding_phone');
      sessionStorage.removeItem('onboarding_company');

      toast({
        title: "Bienvenue !",
        description: "Votre compte a été créé avec succès",
      });

      navigate('/start/welcome');
    } catch (error: any) {
      logError('Error verifying OTP:', error);
      setCode('');
      toast({
        title: "Code invalide",
        description: "Le code entré est incorrect ou a expiré",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;

    setIsResending(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Code renvoyé",
        description: "Un nouveau code a été envoyé",
      });

      setCountdown(60);
      setCanResend(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de renvoyer le code",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
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
            Vérification
          </h1>
          <p className="text-slate-400">
            Un code a été envoyé au{' '}
            <span className="text-cyan-400 font-medium">
              {maskPhone(phone || '')}
            </span>
          </p>
        </motion.div>

        {/* OTP Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center space-y-8"
        >
          <div className="relative">
            <InputOTP
              value={code}
              onChange={setCode}
              maxLength={6}
              disabled={isLoading}
              className="gap-3"
            >
              <InputOTPGroup className="gap-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="w-12 h-14 text-xl font-bold bg-white/5 border-white/20 text-white rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
              </div>
            )}
          </div>

          {/* Resend button */}
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={!canResend || isResending}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            {isResending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {canResend
              ? "Renvoyer le code"
              : `Renvoyer dans ${countdown}s`
            }
          </Button>
        </motion.div>

        {/* Back button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex justify-center mt-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/start')}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Modifier le numéro
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
