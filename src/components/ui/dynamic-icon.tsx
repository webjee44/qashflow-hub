import { 
  TrendingUp, 
  Briefcase, 
  RotateCcw, 
  Users, 
  Building, 
  Package, 
  Megaphone, 
  Laptop, 
  Car, 
  Utensils, 
  Plane, 
  Phone,
  Tag,
  LucideProps
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  TrendingUp,
  Briefcase,
  RotateCcw,
  Users,
  Building,
  Package,
  Megaphone,
  Laptop,
  Car,
  Utensils,
  Plane,
  Phone,
  Tag,
};

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = iconMap[name] || Tag;
  return <IconComponent {...props} />;
}
