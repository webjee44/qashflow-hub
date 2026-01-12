import { motion } from 'framer-motion';
import { forecasts } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Edit3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';

export function ForecastTable() {
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const calculateVariance = (expected: number, actual?: number) => {
    if (!actual) return null;
    return ((actual - expected) / expected) * 100;
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
    >
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Prévisions mensuelles</h3>
        <p className="text-sm text-muted-foreground">Cliquez sur une cellule pour modifier les prévisions</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-semibold text-foreground">Mois</th>
              <th className="text-right p-4 font-semibold text-success">Encaissements prévus</th>
              <th className="text-right p-4 font-semibold text-success/60">Encaissements réels</th>
              <th className="text-right p-4 font-semibold text-destructive">Décaissements prévus</th>
              <th className="text-right p-4 font-semibold text-destructive/60">Décaissements réels</th>
              <th className="text-right p-4 font-semibold text-primary">Solde net prévu</th>
              <th className="text-center p-4 font-semibold text-muted-foreground">Écart</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((forecast, index) => {
              const expectedNet = forecast.expectedIncome - forecast.expectedExpense;
              const actualNet = forecast.actualIncome && forecast.actualExpense 
                ? forecast.actualIncome - forecast.actualExpense 
                : null;
              const variance = actualNet !== null 
                ? ((actualNet - expectedNet) / Math.abs(expectedNet)) * 100 
                : null;

              return (
                <motion.tr
                  key={forecast.month}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={cn(
                    "border-b border-border hover:bg-muted/30 transition-colors",
                    !forecast.actualIncome && "bg-muted/10"
                  )}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{forecast.month}</span>
                      {!forecast.actualIncome && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Projection
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* Expected Income */}
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setEditingCell(`${forecast.month}-income`)}
                      className="group inline-flex items-center gap-2 hover:bg-success/10 px-2 py-1 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-success">{formatValue(forecast.expectedIncome)}</span>
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>

                  {/* Actual Income */}
                  <td className="p-4 text-right">
                    {forecast.actualIncome ? (
                      <span className="text-success/80">{formatValue(forecast.actualIncome)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Expected Expense */}
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setEditingCell(`${forecast.month}-expense`)}
                      className="group inline-flex items-center gap-2 hover:bg-destructive/10 px-2 py-1 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-destructive">{formatValue(forecast.expectedExpense)}</span>
                      <Edit3 className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </td>

                  {/* Actual Expense */}
                  <td className="p-4 text-right">
                    {forecast.actualExpense ? (
                      <span className="text-destructive/80">{formatValue(forecast.actualExpense)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Expected Net */}
                  <td className="p-4 text-right">
                    <span className={cn(
                      "font-semibold",
                      expectedNet >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {formatValue(expectedNet)}
                    </span>
                  </td>

                  {/* Variance */}
                  <td className="p-4 text-center">
                    {variance !== null ? (
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                        variance > 5 && "bg-success/10 text-success",
                        variance < -5 && "bg-destructive/10 text-destructive",
                        Math.abs(variance) <= 5 && "bg-muted text-muted-foreground"
                      )}>
                        {variance > 5 && <TrendingUp className="w-3.5 h-3.5" />}
                        {variance < -5 && <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(variance) <= 5 && <Minus className="w-3.5 h-3.5" />}
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
