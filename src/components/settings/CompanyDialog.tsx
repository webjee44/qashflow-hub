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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompany, Company, VatRegime } from '@/hooks/useCompany';
import { Building2, Wallet } from 'lucide-react';
import { logError } from '@/lib/logger';

const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  initial_balance: z.coerce.number().default(0),
  is_default: z.boolean().default(false),
  vat_regime: z.enum(['monthly', 'quarterly', 'none']).default('monthly'),
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
      initial_balance: 0,
      is_default: false,
      vat_regime: 'monthly',
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        initial_balance: company.initial_balance || 0,
        is_default: company.is_default,
        vat_regime: (company.vat_regime ?? 'monthly') as VatRegime,
      });
    } else {
      form.reset({
        name: '',
        initial_balance: 0,
        is_default: false,
        vat_regime: 'monthly',
      });
    }
  }, [company, form, open]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing) {
        await updateCompany(company.id, {
          name: values.name,
          is_default: values.is_default,
          initial_balance: values.initial_balance,
          vat_regime: values.vat_regime,
        });
      } else {
        await createCompany({
          name: values.name,
          initial_balance: values.initial_balance,
          is_default: values.is_default,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      logError('Error saving company:', error);
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
              name="initial_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Solde initial
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Solde de départ de vos comptes bancaires
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vat_regime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Régime de TVA</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="quarterly">Trimestriel</SelectItem>
                      <SelectItem value="none">Non assujetti</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Détermine la fréquence de décaissement de la TVA planifiée dans la trésorerie.
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
