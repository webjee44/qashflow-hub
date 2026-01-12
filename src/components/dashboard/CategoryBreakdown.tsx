import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { transactions, categories } from '@/lib/mockData';

export function CategoryBreakdown() {
  // Calculate expense by category
  const expenseByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const cat = t.category;
      acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const data = Object.entries(expenseByCategory).map(([name, value]) => {
    const category = categories.find(c => c.name === name);
    return {
      name,
      value,
      color: category?.color || 'hsl(220, 14%, 96%)',
    };
  });

  const totalExpense = data.reduce((acc, d) => acc + d.value, 0);

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / totalExpense) * 100).toFixed(1);
      return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatValue(data.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="bg-card rounded-2xl border border-border shadow-card p-6"
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Répartition des dépenses</h3>
        <p className="text-sm text-muted-foreground">Ce mois-ci</p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {data.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.05 }}
            className="flex items-center gap-2"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-muted-foreground truncate">{item.name}</span>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">Total des dépenses</p>
        <p className="text-2xl font-bold text-foreground">{formatValue(totalExpense)}</p>
      </div>
    </motion.div>
  );
}
