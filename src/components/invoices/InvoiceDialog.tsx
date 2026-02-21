import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import type { Invoice, InvoiceFormData, InvoiceType } from '@/hooks/useInvoices';
import { fr } from 'date-fns/locale';

const VAT_RATES = [
  { value: 0, label: '0%' },
  { value: 5.5, label: '5,5%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
];

const formSchema = z.object({
  type: z.enum(['receivable', 'payable']),
  partner_name: z.string().min(1, 'Le nom du partenaire est requis'),
  invoice_number: z.string().optional(),
  invoice_date: z.string(),
  due_date: z.string(),
  amount_ht: z.number().min(0, 'Le montant doit être positif'),
  vat_rate: z.number(),
  category_id: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  onSubmit: (data: InvoiceFormData) => void;
  partnerSuggestions?: string[];
}

export function InvoiceDialog({ 
  open, 
  onOpenChange, 
  invoice, 
  onSubmit,
  partnerSuggestions = [],
}: InvoiceDialogProps) {
  const { categories } = useCategories();
  const [invoiceDateOpen, setInvoiceDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'receivable',
      partner_name: '',
      invoice_number: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      amount_ht: 0,
      vat_rate: 20,
      category_id: '',
      notes: '',
    },
  });

  const amountHT = form.watch('amount_ht') || 0;
  const vatRate = form.watch('vat_rate') || 0;
  const vatAmount = amountHT * (vatRate / 100);
  const amountTTC = amountHT + vatAmount;
  const invoiceType = form.watch('type');

  // Reset form when dialog opens/closes or invoice changes
  useEffect(() => {
    if (open) {
      if (invoice) {
        const vatRate = invoice.amount_ht > 0 
          ? ((invoice.vat_amount / invoice.amount_ht) * 100) 
          : 20;
        form.reset({
          type: invoice.type,
          partner_name: invoice.partner_name,
          invoice_number: invoice.invoice_number || '',
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          amount_ht: Number(invoice.amount_ht),
          vat_rate: vatRate,
          category_id: invoice.category_id || '',
          notes: invoice.notes || '',
        });
      } else {
        form.reset({
          type: 'receivable',
          partner_name: '',
          invoice_number: '',
          invoice_date: format(new Date(), 'yyyy-MM-dd'),
          due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          amount_ht: 0,
          vat_rate: 20,
          category_id: '',
          notes: '',
        });
      }
    }
  }, [open, invoice, form]);

  const handleSubmit = (values: FormValues) => {
    onSubmit({
      type: values.type,
      partner_name: values.partner_name,
      invoice_number: values.invoice_number,
      invoice_date: values.invoice_date,
      due_date: values.due_date,
      amount_ht: values.amount_ht,
      amount_ttc: amountTTC,
      vat_amount: vatAmount,
      category_id: values.category_id,
      notes: values.notes,
    });
    onOpenChange(false);
  };

  const filteredCategories = categories.filter(c => {
    const isGroup = c.icon === 'Folder' || categories.some(child => child.parent_id === c.id);
    if (isGroup) return false;
    return invoiceType === 'receivable' ? c.type === 'income' : c.type === 'expense';
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {invoice ? 'Modifier la facture' : 'Ajouter une facture'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Tabs
              value={form.watch('type')}
              onValueChange={(v) => form.setValue('type', v as InvoiceType)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="receivable">Créance client</TabsTrigger>
                <TabsTrigger value="payable">Dette fournisseur</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Partner name */}
          <div className="space-y-2">
            <Label htmlFor="partner_name">
              {invoiceType === 'receivable' ? 'Client' : 'Fournisseur'} *
            </Label>
            <Input
              id="partner_name"
              {...form.register('partner_name')}
              placeholder={invoiceType === 'receivable' ? 'Nom du client' : 'Nom du fournisseur'}
              list="partner-suggestions"
            />
            <datalist id="partner-suggestions">
              {partnerSuggestions.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {form.formState.errors.partner_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.partner_name.message}
              </p>
            )}
          </div>

          {/* Invoice number */}
          <div className="space-y-2">
            <Label htmlFor="invoice_number">N° Facture</Label>
            <Input
              id="invoice_number"
              {...form.register('invoice_number')}
              placeholder="FAC-001"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date d'émission</Label>
              <Popover open={invoiceDateOpen} onOpenChange={setInvoiceDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch('invoice_date') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('invoice_date') 
                      ? format(new Date(form.watch('invoice_date')), 'd MMM yyyy', { locale: fr })
                      : 'Sélectionner'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('invoice_date') ? new Date(form.watch('invoice_date')) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        form.setValue('invoice_date', format(date, 'yyyy-MM-dd'));
                        setInvoiceDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date d'échéance *</Label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch('due_date') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('due_date') 
                      ? format(new Date(form.watch('due_date')), 'd MMM yyyy', { locale: fr })
                      : 'Sélectionner'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('due_date') ? new Date(form.watch('due_date')) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        form.setValue('due_date', format(date, 'yyyy-MM-dd'));
                        setDueDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Amounts */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount_ht">Montant HT (€) *</Label>
                <Input
                  id="amount_ht"
                  type="number"
                  step="0.01"
                  {...form.register('amount_ht', { valueAsNumber: true })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Taux de TVA</Label>
                <Select
                  value={form.watch('vat_rate')?.toString()}
                  onValueChange={(v) => form.setValue('vat_rate', parseFloat(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_RATES.map(rate => (
                      <SelectItem key={rate.value} value={rate.value.toString()}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVA ({vatRate}%)</span>
                <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(vatAmount)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total TTC</span>
                <span className={cn(
                  "text-lg",
                  invoiceType === 'receivable' ? 'text-success' : 'text-destructive'
                )}>
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amountTTC)}
                </span>
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select
              value={form.watch('category_id') || ''}
              onValueChange={(v) => form.setValue('category_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Notes optionnelles..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit">
              {invoice ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
