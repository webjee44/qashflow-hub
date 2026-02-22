import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    navigate(user ? '/onboarding' : '/sign-in', { replace: true });
  }, [user, navigate]);

  return null;
}
