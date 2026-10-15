import { Crown } from "lucide-react";
import VehicleForm from "../components/VehicleForm";
import BackLink from "../components/BackLink";
import { planForVehicles, type Plan } from "../lib/plans";
import { navigate, paths } from "../lib/router";
import type { CatalogEntry, VehicleInput } from "../types";

interface Props {
  catalog: CatalogEntry[];
  onCreate: (vehicle: VehicleInput) => Promise<void>;
  /** The user's plan and how many vehicles they own, for the vehicle limit. */
  plan: Plan;
  /** Vehicles the user may own (unlimited for admins). */
  limit: number;
  ownedCount: number;
}

export default function NewVehiclePage({ catalog, onCreate, plan, limit, ownedCount }: Props) {
  if (ownedCount >= limit) {
    const next = planForVehicles(ownedCount + 1);
    return (
      <>
        <BackLink />
        <section className="mx-auto mt-6 max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <Crown size={28} />
          </span>
          <h2 className="mt-4 text-xl font-bold">Araç sınırına ulaştınız</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {plan.name} pakette en fazla <b>{plan.maxVehicles} araç</b> ekleyebilirsiniz; şu an {ownedCount} aracınız var.
            Daha fazla araç için <b>{next.name}</b> paketi ({next.maxVehicles} araca kadar) yeterli.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <a
              href={paths.plans}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-900/20 transition hover:bg-brand-700"
            >
              Paketleri Gör
            </a>
            <a href={paths.home} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Vazgeç
            </a>
          </div>
        </section>
      </>
    );
  }

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
