import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Crown, Link2, LogOut, Share2, UserMinus, UserPlus, UserRound } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { paths } from "../lib/router";
import type { User, Vehicle, VehicleInvite, VehicleMember } from "../types";
import { useDialog } from "./DialogProvider";

interface Props {
  vehicle: Vehicle;
  currentUser: User;
  /** Called after the current user leaves the vehicle. */
  onLeft: () => void;
}

function inviteUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}${paths.invite(token)}`;
}

/** Who can see this vehicle; the owner invites and removes helpers here. */
export default function SharePanel({ vehicle, currentUser, onLeft }: Props) {
  const isOwner = vehicle.myRole === "owner";
  const dialog = useDialog();
  const [members, setMembers] = useState<VehicleMember[] | null>(null);
  const [invites, setInvites] = useState<VehicleInvite[]>([]);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([
        api.listMembers(vehicle.id),
        isOwner ? api.listInvites(vehicle.id) : Promise.resolve([]),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [vehicle.id, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink() {
    setCreating(true);
    setError(null);
    try {
      const { invite, token } = await api.createInvite(vehicle.id);
      setInvites((prev) => [invite, ...prev]);
      setNewLink(inviteUrl(token));
      setCopied(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function shareLink(link: string) {
    const text = `${vehicle.name} aracının yakıt ve masraf kayıtlarına katılman için davet: ${link}`;
    // The share sheet (WhatsApp, Mesajlar, …) where available, otherwise copy.
    if (navigator.share) {
      try {
        await navigator.share({ title: "CarLog daveti", text });
        return;
      } catch {
        // Cancelled or not allowed: fall back to copying.
      }
    }
    await copyLink(link);
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      await dialog.alert({ title: "Kopyalanamadı", message: "Linki elle seçip kopyalayın.", tone: "danger" });
    }
  }

  async function revoke(invite: VehicleInvite) {
    const confirmed = await dialog.confirm({
      title: "Davet linki iptal edilsin mi?",
      message: "Bu link artık çalışmaz. Linkle daha önce katılmış kişilerin erişimi devam eder.",
      tone: "danger",
      confirmLabel: "İptal Et",
    });
    if (!confirmed) return;
    try {
      await api.revokeInvite(vehicle.id, invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      setNewLink(null);
    } catch (err) {
      await dialog.alert({ title: "İşlem tamamlanamadı", message: errorMessage(err), tone: "danger" });
    }
  }

  async function removeMember(member: VehicleMember) {
    const confirmed = await dialog.confirm({
      title: `"${member.username}" çıkarılsın mı?`,
      message: "Bu kişi artık aracı göremez ve kayıt ekleyemez. Daha önce girdiği kayıtlar silinmez.",
      tone: "danger",
      confirmLabel: "Çıkar",
    });
    if (!confirmed) return;
    try {
      await api.removeMember(vehicle.id, member.userId);
      setMembers((prev) => prev?.filter((m) => m.userId !== member.userId) ?? null);
    } catch (err) {
      await dialog.alert({ title: "İşlem tamamlanamadı", message: errorMessage(err), tone: "danger" });
    }
  }

  async function leave() {
    const confirmed = await dialog.confirm({
      title: "Bu araçtan ayrılmak istiyor musunuz?",
      message: `"${vehicle.name}" artık garajınızda görünmez. Girdiğiniz kayıtlar araçta kalır. Tekrar katılmak için yeni bir davet gerekir.`,
      tone: "danger",
      confirmLabel: "Ayrıl",
    });
    if (!confirmed) return;
    try {
      await api.removeMember(vehicle.id, currentUser.id);
      onLeft();
    } catch (err) {
      await dialog.alert({ title: "İşlem tamamlanamadı", message: errorMessage(err), tone: "danger" });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Erişimi Olanlar</h3>
        {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {members == null ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div
                  className={`rounded-full p-2 ${
                    m.role === "owner"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {m.role === "owner" ? <Crown size={16} /> : <UserRound size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.username}
                    {m.userId === currentUser.id ? (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">(siz)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {m.role === "owner" ? "Sahip" : `Yardımcı · ${formatDate(m.addedAt.slice(0, 10))}`}
                  </p>
                </div>
                {isOwner && m.role === "helper" ? (
                  <button
                    type="button"
                    onClick={() => removeMember(m)}
                    aria-label={`${m.username} kişisini çıkar`}
                    title="Araçtan çıkar"
                    className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <UserMinus size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          <b>Yardımcılar</b> aracı görür; dolum, masraf ve hatırlatma ekler ve kendi kayıtlarını düzenler. Silme,
          araç bilgilerini değiştirme ve paylaşım yalnızca <b>sahipte</b>dir.
        </p>

        {!isOwner ? (
          <button
            type="button"
            onClick={leave}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <LogOut size={14} />
            Bu araçtan ayrıl
          </button>
        ) : null}
      </section>

      {isOwner ? (
        <section className="flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Davet Linki</h3>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-slate-600 dark:text-slate-300">
                Linki gönderdiğiniz kişi açıp giriş yapınca (hesabı yoksa hızlıca açarak) bu araca <b>yardımcı</b>{" "}
                olarak katılır. Link 7 gün geçerlidir ve birden çok kişi kullanabilir.
              </p>

              {newLink ? (
                <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-900/30">
                  <p className="mb-2 break-all font-mono text-xs text-slate-700 dark:text-slate-200">{newLink}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => shareLink(newLink)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700"
                    >
                      <Share2 size={14} />
                      Paylaş
                    </button>
                    <button
                      type="button"
                      onClick={() => copyLink(newLink)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Kopyalandı" : "Kopyala"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Güvenlik için link yalnızca şimdi gösterilir; kaybederseniz yenisini oluşturun.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={createLink}
                  disabled={creating}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  <Link2 size={14} />
                  {creating ? "Oluşturuluyor…" : "Davet Linki Oluştur"}
                </button>
              )}

              {invites.length > 0 ? (
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Aktif linkler</p>
                  <ul className="flex flex-col gap-2">
                    {invites.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          {formatDate(i.createdAt.slice(0, 10))} oluşturuldu · {formatDate(i.expiresAt.slice(0, 10))}{" "}
                          tarihine kadar · {i.useCount} kişi katıldı
                        </span>
                        <button
                          type="button"
                          onClick={() => revoke(i)}
                          className="shrink-0 rounded px-2 py-1 font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          İptal Et
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Kullanıcı Adıyla Ekle</h3>
            <AddByUsername
              vehicleId={vehicle.id}
              onAdded={(list) => {
                setMembers(list);
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AddByUsername({ vehicleId, onAdded }: { vehicleId: string; onAdded: (members: VehicleMember[]) => void }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      onAdded(await api.addMember(vehicleId, username.trim()));
      setSuccess(`"${username.trim()}" yardımcı olarak eklendi.`);
      setUsername("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="mb-3 text-slate-600 dark:text-slate-300">Kişinin CarLog hesabı varsa kullanıcı adını yazarak doğrudan ekleyin.</p>
      <div className="flex gap-2">
        <input
          type="text"
          autoCapitalize="none"
          autoComplete="off"
          placeholder="kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          <UserPlus size={16} />
          Ekle
        </button>
      </div>
      {error ? <p className="mt-2 text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? <p className="mt-2 text-emerald-600 dark:text-emerald-400">{success}</p> : null}
    </form>
  );
}
