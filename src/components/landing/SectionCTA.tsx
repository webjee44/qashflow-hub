import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SectionCTA() {
  const navigate = useNavigate();

  return (
    <div className="text-center mt-10">
      <Button variant="outline" size="lg" onClick={() => navigate('/sign-up')}>
        Démarrer mon essai gratuit
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
