-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('credito', 'debito', 'efectivo');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('gasto', 'ingreso');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('manual', 'telegram');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('cierre', 'limite', 'reconciliacion');

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "bank" TEXT,
    "closingDay" INTEGER,
    "dueDay" INTEGER,
    "limitAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'UYU',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOwner" BOOLEAN NOT NULL DEFAULT true,
    "linkedPaymentCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "emoji" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UYU',
    "type" "TransactionType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT,
    "source" "Source" NOT NULL DEFAULT 'manual',
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBalance" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "expectedBalance" DOUBLE PRECISION NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "cardId" TEXT,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBalance_cardId_month_year_key" ON "MonthlyBalance"("cardId", "month", "year");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_linkedPaymentCardId_fkey" FOREIGN KEY ("linkedPaymentCardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBalance" ADD CONSTRAINT "MonthlyBalance_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
