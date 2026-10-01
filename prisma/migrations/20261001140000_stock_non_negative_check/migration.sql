-- AlterTable
-- Adiciona constraint de integridade para garantir que saldos de estoque nunca sejam negativos
ALTER TABLE "Stock" ADD CONSTRAINT "stock_quantity_non_negative" CHECK ("quantity" >= 0);
