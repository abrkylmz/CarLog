import VehicleForm from "../components/VehicleForm";
import BackLink from "../components/BackLink";
import { navigate, paths } from "../lib/router";
import type { CatalogEntry, VehicleInput } from "../types";

interface Props {
  catalog: CatalogEntry[];
  onCreate: (vehicle: VehicleInput) => Promise<void>;
}

export default function NewVehiclePage({ catalog, onCreate }: Props) {
  return (
    <>
      <BackLink />
      <h2 className="mb-4 text-lg font-semibold">Yeni Araç</h2>
      <VehicleForm
        // Remount once the catalog arrives, so a direct visit still starts in catalog mode.
        key={catalog.length > 0 ? "catalog" : "loading"}
        catalog={catalog}
        submitLabel="Aracı Ekle"
        onSubmit={onCreate}
        onCancel={() => navigate(paths.home)}
      />
    </>
  );
}
