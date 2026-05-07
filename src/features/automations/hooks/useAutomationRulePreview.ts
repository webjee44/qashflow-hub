import { useEffect, useRef, useState } from 'react';
import {
  fetchAutomationRulePreview,
  type AutomationPreview,
  type PreviewRequestInput,
} from '../api/automationPreviewApi';

interface UseAutomationRulePreviewOptions {
  enabled?: boolean;
  debounceMs?: number;
  request: PreviewRequestInput | null;
}

interface UseAutomationRulePreviewResult {
  preview: AutomationPreview | null;
  loading: boolean;
  error: string | null;
}

/**
 * Server-side dry-run hook. Debounces the request and cancels stale ones.
 * The frontend never computes match impact locally — single source of truth
 * is the `automation-rule-preview` edge function.
 */
export function useAutomationRulePreview(
  options: UseAutomationRulePreviewOptions,
): UseAutomationRulePreviewResult {
  const { enabled = true, debounceMs = 350, request } = options;
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Stable serialization for the dependency.
  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!enabled || !request || !key) {
      setPreview(null);
      setLoading(false);
      setError(null);
      return;
    }

    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    const handle = setTimeout(async () => {
      try {
        const result = await fetchAutomationRulePreview(request);
        if (reqIdRef.current === myReqId) {
          setPreview(result);
          setLoading(false);
        }
      } catch (err) {
        if (reqIdRef.current === myReqId) {
          setPreview(null);
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, debounceMs]);

  return { preview, loading, error };
}
