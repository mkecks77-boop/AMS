-- CreateTable
CREATE TABLE "public"."SsoConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "emailDomains" TEXT[],
    "autoProvision" BOOLEAN NOT NULL DEFAULT false,
    "enforce" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SsoState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoConfig_organizationId_key" ON "public"."SsoConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoState_stateHash_key" ON "public"."SsoState"("stateHash");

-- AddForeignKey
ALTER TABLE "public"."SsoConfig" ADD CONSTRAINT "SsoConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
