-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDENTE', 'APROVADA', 'ATENDIDA', 'REJEITADA', 'CANCELADA');

-- AlterTable Stock
ALTER TABLE "Stock" ADD COLUMN "minimumQuantity" INTEGER;
ALTER TABLE "Stock" ADD COLUMN "maximumQuantity" INTEGER;
CREATE INDEX "Stock_sectorId_idx" ON "Stock"("sectorId");
CREATE INDEX "Stock_productId_idx" ON "Stock"("productId");

-- AlterTable StockMovement
ALTER TABLE "StockMovement" ADD COLUMN "sourceSectorId" UUID;
ALTER TABLE "StockMovement" ADD COLUMN "destinationSectorId" UUID;
ALTER TABLE "StockMovement" ADD COLUMN "requestId" UUID;

-- CreateTable SectorCategory
CREATE TABLE "SectorCategory" (
    "sectorId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectorCategory_pkey" PRIMARY KEY ("sectorId","categoryId")
);

-- CreateTable SectorRequest
CREATE TABLE "SectorRequest" (
    "id" UUID NOT NULL,
    "requestingSectorId" UUID NOT NULL,
    "supplyingSectorId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "attendedByUserId" UUID,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable SectorRequestItem
CREATE TABLE "SectorRequestItem" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "batchId" UUID,
    "requestedQuantity" INTEGER NOT NULL,
    "approvedQuantity" INTEGER,
    "deliveredQuantity" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectorRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_sourceSectorId_idx" ON "StockMovement"("sourceSectorId");
CREATE INDEX "StockMovement_destinationSectorId_idx" ON "StockMovement"("destinationSectorId");
CREATE INDEX "StockMovement_requestId_idx" ON "StockMovement"("requestId");

-- CreateIndex
CREATE INDEX "SectorRequest_requestingSectorId_idx" ON "SectorRequest"("requestingSectorId");
CREATE INDEX "SectorRequest_supplyingSectorId_idx" ON "SectorRequest"("supplyingSectorId");
CREATE INDEX "SectorRequest_status_idx" ON "SectorRequest"("status");

-- CreateIndex
CREATE INDEX "SectorRequestItem_requestId_idx" ON "SectorRequestItem"("requestId");
CREATE INDEX "SectorRequestItem_productId_idx" ON "SectorRequestItem"("productId");

-- AddForeignKey
ALTER TABLE "SectorCategory" ADD CONSTRAINT "SectorCategory_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectorCategory" ADD CONSTRAINT "SectorCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sourceSectorId_fkey" FOREIGN KEY ("sourceSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_destinationSectorId_fkey" FOREIGN KEY ("destinationSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SectorRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorRequest" ADD CONSTRAINT "SectorRequest_requestingSectorId_fkey" FOREIGN KEY ("requestingSectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectorRequest" ADD CONSTRAINT "SectorRequest_supplyingSectorId_fkey" FOREIGN KEY ("supplyingSectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectorRequest" ADD CONSTRAINT "SectorRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectorRequest" ADD CONSTRAINT "SectorRequest_attendedByUserId_fkey" FOREIGN KEY ("attendedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorRequestItem" ADD CONSTRAINT "SectorRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SectorRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectorRequestItem" ADD CONSTRAINT "SectorRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectorRequestItem" ADD CONSTRAINT "SectorRequestItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
