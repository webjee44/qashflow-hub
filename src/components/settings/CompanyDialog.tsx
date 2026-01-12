import { useEffect } from 'react';
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
import { Building2 } from 'lucide-react';

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
        pennylane_api_key: company.pennylane_api_key || '',
        is_default: company.is_default,
      });
    } else {
      form.reset({
        name: '',
        pennylane_api_key: '',
        is_default: false,
      });
    }
  }, [company, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing) {
        await updateCompany(company.id, {
          name: values.name,
          pennylane_api_key: values.pennylane_api_key || null,
          is_default: values.is_default,
        });
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

            <FormField
              control={form.control}
              name="pennylane_api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clé API Pennylane</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Votre clé API Pennylane"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optionnel. Permet de synchroniser les transactions depuis Pennylane.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
