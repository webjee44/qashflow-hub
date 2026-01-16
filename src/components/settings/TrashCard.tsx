import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTrash } from '@/hooks/useTrash';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2, RotateCcw, Building2, ArrowLeftRight, Loader2, Clock, AlertTriangle } from 'lucide-react';

export function TrashCard() {
  const {
    deletedCompanies,
    deletedTransactions,
    isLoading,
    restoreCompany,
    restoreTransaction,
    permanentDeleteCompany,
    permanentDeleteTransaction,
    isRestoring,
    isDeleting,
  } = useTrash();

  const [activeTab, setActiveTab] = useState('companies');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getDaysRemaining = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const expirationDate = new Date(deletedDate);
    expirationDate.setDate(expirationDate.getDate() + 30);
    return differenceInDays(expirationDate, new Date());
  };

  const totalItems = deletedCompanies.length + deletedTransactions.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Corbeille</CardTitle>
            <CardDescription>
              {totalItems === 0
                ? 'Aucun élément supprimé'
                : `${totalItems} élément${totalItems > 1 ? 's' : ''} dans la corbeille`}
            </CardDescription>
          </div>
        </div>
        
        {totalItems > 0 && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Les éléments sont automatiquement supprimés définitivement après 30 jours dans la corbeille.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Sociétés ({deletedCompanies.length})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Transactions ({deletedTransactions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <ScrollArea className="h-[350px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Chargement...
                </div>
              ) : deletedCompanies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Building2 className="h-8 w-8 mb-2 opacity-50" />
                  <p>Aucune société supprimée</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedCompanies.map((company) => (
                    <div
                      key={company.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium truncate">{company.name}</span>
                          {getDaysRemaining(company.deleted_at) <= 7 && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {getDaysRemaining(company.deleted_at)} j restants
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Solde initial: {formatCurrency(company.initial_balance)}</span>
                          <span>•</span>
                          <span>
                            Supprimé{' '}
                            {formatDistanceToNow(new Date(company.deleted_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            Suppression auto dans {getDaysRemaining(company.deleted_at)} jours
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreCompany(company.id)}
                          disabled={isRestoring}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurer
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. La société "{company.name}" et
                                toutes ses données associées seront supprimées définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => permanentDeleteCompany(company.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer définitivement
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transactions">
            <ScrollArea className="h-[350px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Chargement...
                </div>
              ) : deletedTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <ArrowLeftRight className="h-8 w-8 mb-2 opacity-50" />
                  <p>Aucune transaction supprimée</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={transaction.type === 'income' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {transaction.type === 'income' ? 'Revenu' : 'Dépense'}
                          </Badge>
                          <span className="font-medium truncate">{transaction.description}</span>
                          {getDaysRemaining(transaction.deleted_at) <= 7 && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {getDaysRemaining(transaction.deleted_at)} j restants
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span
                            className={
                              transaction.type === 'income'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                          <span>•</span>
                          <span>{format(new Date(transaction.date), 'dd MMM yyyy', { locale: fr })}</span>
                          <span>•</span>
                          <span>
                            Supprimé{' '}
                            {formatDistanceToNow(new Date(transaction.deleted_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            Suppression auto dans {getDaysRemaining(transaction.deleted_at)} jours
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreTransaction(transaction.id)}
                          disabled={isRestoring}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurer
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. La transaction "{transaction.description}"
                                sera supprimée définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => permanentDeleteTransaction(transaction.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer définitivement
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}