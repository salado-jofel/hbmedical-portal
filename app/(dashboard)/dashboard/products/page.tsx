import { getAllProducts } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import ProductsTable from "./(sections)/ProductsTable";
import { AddProductModal } from "./(components)/AddProductModal";
import { PageHeader } from "@/app/(components)/PageHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getAllProducts();
  const count = products.length;

  return (
    <Providers products={products}>
      <div className="select-none">
        <PageHeader
          title="Products"
          subtitle={`${count} product${count !== 1 ? "s" : ""} across all facilities`}
          action={<AddProductModal />}
        />
        <ProductsTable />
      </div>
    </Providers>
  );
}
