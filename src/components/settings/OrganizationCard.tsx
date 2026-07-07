import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/hooks/useOrganization';
import { Building2, Edit2, Save, X } from 'lucide-react';

export const OrganizationCard = () => {
  const { currentOrganization, loading, updateOrganization, isOwner } = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setName(currentOrganization?.name || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!currentOrganization || !name.trim()) return;
    setSaving(true);
    try {
      await updateOrganization(currentOrganization.id, { name: name.trim() });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setName('');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!currentOrganization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organisation
          </CardTitle>
          <CardDescription>Aucune organisation trouvée</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Organisation</CardTitle>
        </div>
        <CardDescription>Paramètres de votre organisation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'organisation</Label>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de l'organisation"
              />
              <Button size="icon" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">{currentOrganization.name}</span>
              {isOwner && (
                <Button size="sm" variant="ghost" onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
