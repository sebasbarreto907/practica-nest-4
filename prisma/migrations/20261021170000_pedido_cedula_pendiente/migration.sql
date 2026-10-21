ALTER TABLE "Pedido" ADD COLUMN "cedula" TEXT;

UPDATE "Pedido"
SET "cedula" = 'legacy-' || "id"::TEXT
WHERE "cedula" IS NULL;

ALTER TABLE "Pedido" ALTER COLUMN "cedula" SET NOT NULL;

CREATE UNIQUE INDEX "Pedido_cedula_pendiente_key"
ON "Pedido"("cedula")
WHERE "estado" = 'pendiente';
