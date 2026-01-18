import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Rocket, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBPOnboarding } from '@/hooks/useBPOnboarding';
import { useLocation } from 'react-router-dom';

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function BPOnboardingTour() {
  const location = useLocation();
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useBPOnboarding();

  const [targetPosition, setTargetPosition] = useState<Position | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    // Only show tooltip if we're on the correct route
    if (!location.pathname.startsWith(currentStepData.route.split('?')[0])) {
      return;
    }

    const findTarget = () => {
      const target = document.querySelector(currentStepData.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });

        // Calculate tooltip position
        const tooltipWidth = 360;
        const tooltipHeight = 220;
        const padding = 16;

        let tooltipTop = rect.top + window.scrollY;
        let tooltipLeft = rect.left + window.scrollX;

        switch (currentStepData.position) {
          case 'top':
            tooltipTop = rect.top + window.scrollY - tooltipHeight - padding;
            tooltipLeft = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'bottom':
            tooltipTop = rect.bottom + window.scrollY + padding;
            tooltipLeft = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'left':
            tooltipTop = rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2;
            tooltipLeft = rect.left + window.scrollX - tooltipWidth - padding;
            break;
          case 'right':
            tooltipTop = rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2;
            tooltipLeft = rect.right + window.scrollX + padding;
            break;
        }

        // Keep tooltip in viewport
        tooltipLeft = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, tooltipLeft));
        tooltipTop = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding + window.scrollY, tooltipTop));

        setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
      } else {
        // Target not found, try again
        setTimeout(findTarget, 200);
      }
    };

    // Wait a bit for page to render
    const timeout = setTimeout(findTarget, 300);
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget);
    };
  }, [isActive, currentStepData, location.pathname]);

  if (!isActive || !currentStepData) return null;

  // Don't render if not on correct route
  if (!location.pathname.startsWith(currentStepData.route.split('?')[0])) {
    return null;
  }

  const isLastStep = currentStep === totalSteps - 1;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Overlay with spotlight cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-auto"
          onClick={skipTour}
        >
          <svg className="w-full h-full" style={{ position: 'absolute' }}>
            <defs>
              <mask id="bp-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetPosition && (
                  <rect
                    x={targetPosition.left - 8}
                    y={targetPosition.top - 8}
                    width={targetPosition.width + 16}
                    height={targetPosition.height + 16}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.8)"
              mask="url(#bp-spotlight-mask)"
            />
          </svg>
        </motion.div>

        {/* Target highlight ring */}
        {targetPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute pointer-events-none"
            style={{
              top: targetPosition.top - 8,
              left: targetPosition.left - 8,
              width: targetPosition.width + 16,
              height: targetPosition.height + 16,
            }}
          >
            <div className="w-full h-full rounded-xl ring-2 ring-emerald-400 ring-offset-4 ring-offset-transparent animate-pulse" />
          </motion.div>
        )}

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute z-10 pointer-events-auto"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: 360,
          }}
        >
          <div className="relative bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={skipTour}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">
                Business Plan • Étape {currentStep + 1}/{totalSteps}
              </span>
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-white mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              {currentStepData.description}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentStep
                      ? 'bg-emerald-400 w-6'
                      : i < currentStep
                      ? 'bg-emerald-400/50'
                      : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="text-slate-400 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Passer
                </Button>
                <Button
                  size="sm"
                  onClick={isLastStep ? completeTour : nextStep}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white"
                >
                  {isLastStep ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Terminer
                    </>
                  ) : (
                    <>
                      Suivant
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
