import * as React from 'react';
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
  LucideProps,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
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

export interface DynamicIconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

export const DynamicIcon = React.forwardRef<SVGSVGElement, DynamicIconProps>(
  ({ name, ...props }, ref) => {
    const IconComponent = iconMap[name] || Tag;
    return <IconComponent ref={ref} {...props} />;
  },
);
DynamicIcon.displayName = 'DynamicIcon';

