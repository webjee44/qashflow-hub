import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2, Users, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FixedExpenseTable } from '@/components/businessplan/FixedExpenseTable';
import { FixedExpenseDialog } from '@/components/businessplan/FixedExpenseDialog';
import { PersonnelTable } from '@/components/businessplan/PersonnelTable';
import { PersonnelDialog } from '@/components/businessplan/PersonnelDialog';
import { VariableExpenseTable } from '@/components/businessplan/VariableExpenseTable';
import { useFixedExpenses, FixedExpense } from '@/hooks/useFixedExpenses';
import { usePersonnel, Personnel } from '@/hooks/usePersonnel';

export default function Expenses() {
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | null>(null);
  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);

  const { expenses, createExpense, updateExpense, deleteExpense } = useFixedExpenses();
  const { personnel, createPersonnel, updatePersonnel, deletePersonnel } = usePersonnel();

  const handleSaveExpense = (data: Partial<FixedExpense>) => {
    if (data.id) {
      updateExpense.mutate(data as FixedExpense & { id: string });
    } else {
      createExpense.mutate(data);
    }
  };

  const handleEditExpense = (expense: FixedExpense) => {
    setSelectedExpense(expense);
    setExpenseDialogOpen(true);
  };

  const handleSavePersonnel = (data: Partial<Personnel>) => {
    if (data.id) {
      updatePersonnel.mutate(data as Personnel & { id: string });
    } else {
      createPersonnel.mutate(data);
    }
  };

  const handleEditPersonnel = (person: Personnel) => {
    setSelectedPersonnel(person);
    setPersonnelDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Charges & Personnel</h1>
          <p className="text-muted-foreground mt-1">Gérez vos charges fixes, variables et votre masse salariale</p>
        </div>
      </div>

      <Tabs defaultValue="fixed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fixed" className="gap-2">
            <Building2 className="h-4 w-4" />
            Charges fixes
          </TabsTrigger>
          <TabsTrigger value="variable" className="gap-2">
            <Percent className="h-4 w-4" />
            Charges variables
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2">
            <Users className="h-4 w-4" />
            Personnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Charges fixes</CardTitle>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => {
                    setSelectedExpense(null);
                    setExpenseDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une charge
                </Button>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">Aucune charge fixe</p>
                      <p className="text-sm">Loyer, assurances, abonnements SaaS...</p>
                    </div>
                  </div>
                ) : (
                  <FixedExpenseTable onEdit={handleEditExpense} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="variable">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <VariableExpenseTable />
          </motion.div>
        </TabsContent>

        <TabsContent value="personnel">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personnel</CardTitle>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => {
                    setSelectedPersonnel(null);
                    setPersonnelDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un poste
                </Button>
              </CardHeader>
              <CardContent>
                {personnel.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">Aucun personnel</p>
                      <p className="text-sm">Planifiez vos recrutements et salaires</p>
                    </div>
                  </div>
                ) : (
                  <PersonnelTable onEdit={handleEditPersonnel} />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      <FixedExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={selectedExpense}
        onSave={handleSaveExpense}
      />

      <PersonnelDialog
        open={personnelDialogOpen}
        onOpenChange={setPersonnelDialogOpen}
        personnel={selectedPersonnel}
        onSave={handleSavePersonnel}
      />
    </div>
  );
}
