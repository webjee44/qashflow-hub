import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Package } from 'lucide-react';
import { useStocks, Stock } from '@/hooks/useStocks';
import { StockDialog } from './StockDialog';
import { useBPSettings } from '@/hooks/useBPSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function StockTable() {
  const { stocks, isLoading, createStock, updateStock, deleteStock, getStockVariation } = useStocks();
  const { settings } = useBPSettings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<Stock | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const handleSave = (data: Partial<Stock>) => {
    if (editingStock) {
      updateStock.mutate({ ...editingStock, ...data } as Stock);
    } else {
      createStock.mutate(data);
    }
  };

  const handleEdit = (stock: Stock) => {
    setEditingStock(stock);
    setDialogOpen(true);
  };

  const handleDelete = (stock: Stock) => {
    setStockToDelete(stock);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (stockToDelete) {
      deleteStock.mutate(stockToDelete.id);
    }
    setDeleteDialogOpen(false);
    setStockToDelete(null);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  // Group by fiscal year
  const yearOptions = Array.from({ length: settings.bp_years || 3 }, (_, i) => i + 1);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stock</TableHead>
            <TableHead>Année</TableHead>
            <TableHead className="text-right">Stock Initial</TableHead>
            <TableHead className="text-right">Achats</TableHead>
            <TableHead className="text-right">Stock Final</TableHead>
            <TableHead className="text-right">Variation</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun stock configuré</p>
                <Button
                  variant="link"
                  onClick={() => {
                    setEditingStock(null);
                    setDialogOpen(true);
                  }}
                >
                  Ajouter un stock
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            stocks.map((stock) => {
              const variation = Number(stock.initial_stock) + Number(stock.purchase_amount) - Number(stock.final_stock);
              return (
                <TableRow key={stock.id}>
                  <TableCell className="font-medium">{stock.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Année {stock.fiscal_year}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(stock.initial_stock))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(stock.purchase_amount))}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(stock.final_stock))}</TableCell>
                  <TableCell className={`text-right font-medium ${variation > 0 ? 'text-destructive' : variation < 0 ? 'text-success' : ''}`}>
                    {variation > 0 ? '+' : ''}{formatCurrency(variation)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(stock)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(stock)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
          {/* Summary rows per year */}
          {stocks.length > 0 && yearOptions.map(year => {
            const yearVariation = getStockVariation(year);
            const yearStocks = stocks.filter(s => s.fiscal_year === year);
            if (yearStocks.length === 0) return null;
            
            return (
              <TableRow key={`summary-${year}`} className="bg-muted/30 font-semibold">
                <TableCell colSpan={5}>Total Année {year}</TableCell>
                <TableCell className={`text-right ${yearVariation > 0 ? 'text-destructive' : yearVariation < 0 ? 'text-success' : ''}`}>
                  {yearVariation > 0 ? '+' : ''}{formatCurrency(yearVariation)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <StockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stock={editingStock}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le stock ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le stock "{stockToDelete?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
