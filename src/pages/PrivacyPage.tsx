import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CONTACT_EMAIL, DATA_CONTROLLER, PRIVACY_UPDATED } from "../lib/legal";
import { formatDate } from "../lib/format";
import { paths } from "../lib/router";

/** KVKK (6698) privacy notice: what CarLog keeps about its users, why, for how long, and their rights. */
export default function PrivacyPage() {
  const controller = DATA_CONTROLLER || "CarLog uygulamasını işleten kişi";
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
      <a href={paths.home} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} />
        CarLog
      </a>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        <ShieldCheck size={26} className="text-brand-600" />
        KVKK Aydınlatma Metni
      </h1>
      <p className="mt-1 text-sm text-slate-500">Son güncelleme: {formatDate(PRIVACY_UPDATED)}</p>

      <Section title="1. Veri sorumlusu">
        6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu {controller}'dır.
        {CONTACT_EMAIL ? (
          <>
            {" "}
            Başvurularınız için: <b>{CONTACT_EMAIL}</b>.
          </>
        ) : null}
      </Section>

      <Section title="2. Hangi verileri işliyoruz?">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Hesap:</b> kullanıcı adı, şifrenizin geri çevrilemez özeti (şifrenin kendisi saklanmaz), isteğe bağlı e-posta adresi, paket ve aylık bütçe tercihi.</li>
          <li><b>Araç ve kayıtlar:</b> araç bilgileri (marka, model, plaka, yıl), yakıt dolumları, masraflar, bakım kayıtları, hatırlatmalar ve eklediğiniz fatura fotoğrafları.</li>
          <li><b>Paylaşım:</b> bir aracı paylaştığınız kişilerin kullanıcı adları ve hangi kaydı kimin eklediği.</li>
          <li><b>Kullanım ve güvenlik:</b> oturum bilgisi, son giriş zamanı, bildirim aboneliği, kötüye kullanımı engellemek için geçici olarak IP adresi ve uygulamada oluşan hata kayıtları.</li>
          <li><b>Fiş okuma:</b> "Fiş Tara" ile çektiğiniz fiş fotoğrafı yalnızca okunmak için işlenir, saklanmaz.</li>
        </ul>
      </Section>

      <Section title="3. Hangi amaçlarla?">
        Hesabınızı oluşturmak ve güvenle giriş yapmanızı sağlamak; yakıt ve masraf kayıtlarınızı tutmak, tüketim ve
        harcama raporlarını hazırlamak; hatırlatma ve aylık özet bildirimlerini göndermek; şifre sıfırlama bağlantısı
        iletmek; uygulamanın güvenliğini sağlamak ve hataları gidermek.
      </Section>

      <Section title="4. Hukuki sebepler">
        Verileriniz KVKK m.5/2-c (sözleşmenin kurulması ve ifası: uygulamayı size sunabilmek), m.5/2-f (veri
        sorumlusunun meşru menfaati: güvenlik ve hata giderme) ve gerekli olduğu ölçüde m.5/1 (açık rıza) kapsamında
        işlenir.
      </Section>

      <Section title="5. Kimlere aktarılır?">
        Verileriniz satılmaz ve reklam amacıyla kullanılmaz. Uygulamanın çalışması için gereken hizmet sağlayıcılara
        aktarılır: barındırma (Vercel), veritabanı (Neon), bildirim servisleri (Apple, Google, Mozilla), e-posta gönderimi
        (Resend) ve fiş okuma (Anthropic). Bu sağlayıcıların sunucuları yurt dışında bulunabilir; aktarım KVKK m.9'a
        uygun şekilde yapılır. Bir aracı paylaştığınız kişiler o aracın kayıtlarını görür.
      </Section>

      <Section title="6. Ne kadar süre saklanır?">
        Hesabınız açık olduğu sürece. Hesabınızı sildiğinizde hesabınız ve yalnızca size ait araçların kayıtları
        silinir; paylaşılan bir araca eklediğiniz kayıtlar o araçta, eklayen "silinmiş kullanıcı" olarak kalır. Güvenlik
        amaçlı IP kayıtları 15 dakika, hata kayıtları en fazla son 1.000 kayıt olarak tutulur.
      </Section>

      <Section title="7. Haklarınız (KVKK m.11)">
        Kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi isteme, amacına uygun kullanılıp kullanılmadığını
        öğrenme, aktarıldığı kişileri bilme, eksik ya da yanlış işlenmişse düzeltilmesini, silinmesini veya yok
        edilmesini isteme, bunların aktarıldığı kişilere bildirilmesini isteme, otomatik analiz sonucu aleyhinize bir
        sonuca itiraz etme ve zarara uğramanız hâlinde giderilmesini talep etme haklarına sahipsiniz.
        <br />
        Verilerinizi uygulama içinden <b>Dışa Aktar</b> ile indirebilir, hesabınızı <b>Profil → Hesabımı sil</b> ile
        kendiniz silebilirsiniz.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
