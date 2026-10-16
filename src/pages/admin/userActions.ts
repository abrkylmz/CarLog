import type { DialogApi } from "../../components/DialogProvider";
import { api, ApiError, errorMessage } from "../../lib/api";
import type { Role, User } from "../../types";

export const ROLE_LABELS: Record<Role, string> = { admin: "Yönetici", moderator: "Moderatör", user: "Kullanıcı" };

/** Asks for a new password and sets it; false when cancelled or failed. */
export async function resetPassword(dialog: DialogApi, user: User): Promise<boolean> {
  const password = await dialog.prompt({
    title: `"${user.username}" için yeni şifre`,
    message: "Kaydedince kullanıcının açık oturumları kapanır; yeni şifreyle tekrar giriş yapması gerekir.",
    confirmLabel: "Şifreyi Kaydet",
    input: {
      label: "Yeni şifre",
      type: "password",
      placeholder: "En az 8 karakter",
      validate: (value) => (value.length < 8 ? "Şifre en az 8 karakter olmalı." : null),
    },
  });
  if (password == null) return false;
  try {
    await api.setUserPassword(user.id, password);
    await dialog.alert({ title: "Şifre güncellendi", message: `"${user.username}" kullanıcısının tüm oturumları kapatıldı.`, tone: "success" });
    return true;
  } catch (err) {
    await dialog.alert({ title: "Şifre değiştirilemedi", message: errorMessage(err), tone: "danger" });
    return false;
  }
}

/** Deletes an account after confirming; a second confirmation when it owns vehicles. */
export async function deleteAccount(dialog: DialogApi, user: User): Promise<boolean> {
  const confirmed = await dialog.confirm({
    title: `"${user.username}" silinsin mi?`,
    message: "Hesap kalıcı olarak silinir.",
    tone: "danger",
    confirmLabel: "Kullanıcıyı Sil",
  });
  if (!confirmed) return false;
  try {
    try {
      await api.deleteUser(user.id);
    } catch (err) {
      // 409: the user owns vehicles; the server explains what happens to them.
      if (!(err instanceof ApiError && err.status === 409)) throw err;
      const sure = await dialog.confirm({ title: "Kullanıcının araçları var", message: `${err.message} Devam edilsin mi?`, tone: "danger", confirmLabel: "Yine de Sil" });
      if (!sure) return false;
      await api.deleteUser(user.id, true);
    }
    return true;
  } catch (err) {
    await dialog.alert({ title: "Kullanıcı silinemedi", message: errorMessage(err), tone: "danger" });
    return false;
  }
}

/** Changes a role after confirming (the account is signed out); returns the updated user. */
export async function changeRole(dialog: DialogApi, user: User, role: Role): Promise<User | null> {
  const confirmed = await dialog.confirm({
    title: `${user.username}: ${ROLE_LABELS[role]}`,
    message:
      role === "admin"
        ? "Yöneticiler her şeye erişebilir: kullanıcılar, roller, katalog. Hesabın açık oturumları kapatılır."
        : role === "moderator"
          ? "Moderatörler canlı desteği yanıtlar ve hata kayıtlarını görür. Hesabın açık oturumları kapatılır."
          : "Hesap normal kullanıcıya döner ve açık oturumları kapatılır.",
    confirmLabel: "Rolü Değiştir",
  });
  if (!confirmed) return null;
  try {
    return await api.setUserRole(user.id, role);
  } catch (err) {
    await dialog.alert({ title: "Rol değiştirilemedi", message: errorMessage(err), tone: "danger" });
    return null;
  }
}
