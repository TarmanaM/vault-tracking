-- CreateTable
CREATE TABLE "exchange_rate_history" (
    "id" SERIAL NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rateDate" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FRANKFURTER_V2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rate_history_quoteCurrency_rateDate_idx" ON "exchange_rate_history"("quoteCurrency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_history_baseCurrency_quoteCurrency_rateDate_key" ON "exchange_rate_history"("baseCurrency", "quoteCurrency", "rateDate");
