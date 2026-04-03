import { getAllProducts } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import ProductsTable from "./(sections)/ProductsTable";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  const products = await getAllProducts();
  return (
    <Providers products={products}>
      <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6 select-none h-full overflow-y-auto">
        <Header />
        <ProductsTable />
      </div>
    </Providers>
  );
}
