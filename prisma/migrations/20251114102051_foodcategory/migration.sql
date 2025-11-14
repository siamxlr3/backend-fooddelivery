/*
  Warnings:

  - You are about to drop the column `category` on the `Food` table. All the data in the column will be lost.
  - Added the required column `categoryID` to the `Food` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `price` on the `Food` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Food" DROP COLUMN "category",
ADD COLUMN     "categoryID" INTEGER NOT NULL,
DROP COLUMN "price",
ADD COLUMN     "price" DECIMAL(65,30) NOT NULL;

-- CreateTable
CREATE TABLE "foodcategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foodcategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_categoryID_fkey" FOREIGN KEY ("categoryID") REFERENCES "foodcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
