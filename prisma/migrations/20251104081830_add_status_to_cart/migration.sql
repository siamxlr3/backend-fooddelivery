-- CreateEnum
CREATE TYPE "Status" AS ENUM ('Pending', 'Cancelled', 'Success');

-- CreateTable
CREATE TABLE "cart" (
    "id" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "foodID" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_userID_fkey" FOREIGN KEY ("userID") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_foodID_fkey" FOREIGN KEY ("foodID") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
