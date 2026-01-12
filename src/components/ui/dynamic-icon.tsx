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
} from 'lucide-react';

const iconMap = {
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
} as const;

type IconName = keyof typeof iconMap;

export interface DynamicIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number | string;
}

export function DynamicIcon({ name, size = 24, className, ...props }: DynamicIconProps) {
  const IconComponent = iconMap[name as IconName] || Tag;
  return <IconComponent size={size} className={className} {...(props as any)} />;
}
