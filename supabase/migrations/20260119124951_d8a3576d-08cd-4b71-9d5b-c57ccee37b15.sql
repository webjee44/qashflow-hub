-- Add show_funding_plan column to bp_settings table
-- This separates "Financements" (show_financing) from "Plan de financement" (show_funding_plan)
ALTER TABLE bp_settings 
ADD COLUMN show_funding_plan boolean DEFAULT true;