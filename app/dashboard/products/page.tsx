import { getAllProducts } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import ProductsTable from "./(sections)/ProductsTable";

export default async function ProductsPage() {
  const products = await getAllProducts();
  return (
    <Providers products={products}>
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto">
        <Header />
        <ProductsTable />
      </div>
    </Providers>
  );
}
