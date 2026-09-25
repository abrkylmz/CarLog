import VehicleForm from "../components/VehicleForm";
import BackLink from "../components/BackLink";
import { navigate, paths } from "../lib/router";
import type { VehicleInput } from "../types";

interface Props {
  onCreate: (vehicle: VehicleInput) => Promise<void>;
}

export default function NewVehiclePage({ onCreate }: Props) {
  return (
    <>
      <BackLink />
      <h2 className="mb-4 text-lg font-semibold">Yeni Araç</h2>
      <VehicleForm submitLabel="Aracı Ekle" onSubmit={onCreate} onCancel={() => navigate(paths.home)} />
    </>
  );
}
