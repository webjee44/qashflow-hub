import { useOrganization } from './useOrganization';

interface DemoRestrictions {
  canExport: boolean;
  canInviteMembers: boolean;
  canConnectBank: boolean;
  canUpgrade: boolean;
  showDemoBanner: boolean;
}

export function useDemoMode() {
  const { currentOrganization } = useOrganization();
  
  const isDemo = currentOrganization?.is_demo ?? false;
  
  const restrictions: DemoRestrictions = {
    canExport: !isDemo,
    canInviteMembers: !isDemo,
    canConnectBank: !isDemo,
    canUpgrade: !isDemo,
    showDemoBanner: isDemo,
  };

  return {
    isDemo,
    restrictions,
  };
}
