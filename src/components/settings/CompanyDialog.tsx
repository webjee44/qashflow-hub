import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useCompany, Company } from '@/hooks/useCompany';
import { Building2, Key, ShieldCheck } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  pennylane_api_key: z.string().optional(),
  is_default: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
}

export function CompanyDialog({ open, onOpenChange, company }: CompanyDialogProps) {
  const { createCompany, updateCompany } = useCompany();
  const isEditing = !!company;
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      pennylane_api_key: '',
      is_default: false,
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        pennylane_api_key: '', // Never show existing key for security
        is_default: company.is_default,
      });
      setShowApiKeyInput(false);
    } else {
      form.reset({
        name: '',
        pennylane_api_key: '',
        is_default: false,
      });
      setShowApiKeyInput(true);
    }
  }, [company, form, open]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing) {
        // Only include API key if user wants to update it
        const updateData: { name: string; is_default: boolean; pennylane_api_key?: string } = {
          name: values.name,
          is_default: values.is_default,
        };
        
        if (showApiKeyInput && values.pennylane_api_key) {
          updateData.pennylane_api_key = values.pennylane_api_key;
        }
        
        await updateCompany(company.id, updateData);
      } else {
        await createCompany({
          name: values.name,
          pennylane_api_key: values.pennylane_api_key,
          is_default: values.is_default,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {isEditing ? 'Modifier la société' : 'Nouvelle société'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifiez les informations de la société'
              : 'Ajoutez une nouvelle société à gérer'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la société</FormLabel>
                  <FormControl>
                    <Input placeholder="Ma Société" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API Key Section */}
            {isEditing && company?.has_pennylane_key && !showApiKeyInput ? (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>Clé API Pennylane configurée</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKeyInput(true)}
                  className="gap-2"
                >
                  <Key className="w-4 h-4" />
                  Modifier la clé
                </Button>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="pennylane_api_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Clé API Pennylane
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={isEditing ? "Nouvelle clé API" : "Votre clé API Pennylane"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3" />
                      Stockée de manière sécurisée, non accessible en lecture.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Société par défaut</FormLabel>
                    <FormDescription>
                      Sélectionnée automatiquement à la connexion
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {isEditing ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
