import { getFacilityById } from "./(services)/actions";
import { notFound } from "next/navigation";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import FacilityDetails from "./(sections)/FacilityDetails";

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const facility = await getFacilityById(id); 

  if (!facility) notFound();

  return (
    <Providers facility={facility}>
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto bg-slate-50">
        <Header />
        <FacilityDetails />
      </div>
    </Providers>
  );
}
