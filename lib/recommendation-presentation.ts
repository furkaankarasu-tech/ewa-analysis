import { recommendationCopy } from "./finding-copy.ts";

/**
 * Only state actions actually named in SAP's text. This is a compact reading
 * aid, NOT an attempt to paraphrase unrecognized recommendations as fact.
 */
export function groundedRecommendationSummary(source: string): string | null {
  const text = source.replace(/\s+/g, " ").trim();
  const has = (pattern: RegExp) => pattern.test(text);
  const noteRefs = [...new Set((text.match(/SAP\s+(?:Note|note)\s*\d{5,8}/g) ?? []).map(n => n.replace(/SAP\s+note/i, "SAP Note")))];
  const notes = noteRefs.length && noteRefs.length <= 5 ? ` İlgili ${noteRefs.join(", ")} kayıtlarını da inceleyin.` : "";

  if (has(/ST-A\/PI/i) && has(/ST-PI/i) && has(/RTCCTOOL/i) && has(/SAP\s+note/i))
    return `RTCCTOOL ile ST-A/PI ve ST-PI sürümlerini denetleyin. Rapordaki sürüm farklarını ve uygulanacak Support Package/SAP Note düzeltmelerini özgün SAP talimatına göre planlayın.${notes}`;
  if (has(/(?:enable|activate)\s+TLS/i) && has(/(?:system|communication|replication)/i))
    return "SAP, bu iletişim için TLS'nin etkinleştirilmesini istiyor. Sertifika ve bağlantı yapılandırması dahil gerekli adımları orijinal SAP talimatıyla birlikte kontrol edin.";
  if (has(/\buser SYSTEM\b/i) && has(/\buser and role concept\b/i))
    return "SYSTEM kullanıcısının mevcut kullanımını gözden geçirin. SAP'nin belirttiği kullanıcı ve rol düzenini oluşturup test ederek SYSTEM hesabıyla yapılan işlemleri uygun hesaplara taşıyın.";
  if (has(/\b(?:ALTER\s+USER\s+SYSTEM\s+DEACTIVATE\s+USER\s+NOW|deactivate the user account)\b/i) && has(/\bSYSTEM\b/i))
    return "SAP önerisi SYSTEM hesabının kullanımının doğrulanmasını ve artık gerekli değilse hesabın devre dışı bırakılmasını istiyor. İşlemden önce SYSTEM hesabına bağlı süreçleri kontrol edin; özgün SQL komutu aşağıdaki SAP metninde korunur.";
  if (has(/\bSupport Package\b/i) && has(/(?:security maintenance|security patches|security fixes|security updates)/i) && has(/(?:upgrade|update|apply|install|level)/i))
    return `Raporda belirtilen Support Package seviyesinin güvenlik bakım durumunu doğrulayın. SAP'nin önerdiği güncelleme veya güvenlik düzeltmelerini uyumluluk ve test gereksinimleriyle birlikte değerlendirin.${notes}`;
  if (has(/\b(?:upgrade|update)\b/i) && has(/\b(?:main product version|application release)\b/i))
    return `SAP ana ürün sürümünün yükseltilmesini öneriyor. İlgili ürünün güncel bakım bilgilerini ve sürüm geçiş koşullarını kontrol edin.${notes}`;
  if (has(/\bFiori\b/i) && has(/\bMaintenance Planner\b/i))
    return `Fiori bileşenleri için hedef sürümü SAP Maintenance Planner ile doğrulayın. Mevcut uygulamaların uyumluluğunu, bağımlılıkları ve gerekli indirmeleri kontrol ederek yükseltme planı hazırlayın.${notes}`;
  if (has(/\bmessage server\b/i) && has(/(?:ms\/acl_info|access control list|access list)/i))
    return `Message Server erişimini uygun ACL kurallarıyla sınırlandırın. Raporda belirtilen profil parametrelerini ve erişim kontrol dosyasını inceleyin.${notes}`;
  if (has(/\b(?:default password|default passwords)\b/i) && has(/(?:RSUSR003|standard users?)/i))
    return `Standart kullanıcı hesaplarında varsayılan parolaları ${/RSUSR003/i.test(text) ? "RSUSR003 raporuyla " : ""}kontrol edin. Gerekli kullanıcı ve istemciler için rapordaki SAP talimatlarını uygulayın.${notes}`;
  if (has(/\b(?:password|parola)\b/i) && has(/\blogin\/min_password_lng\b/i)) {
    const min = text.match(/\b(?:minimum value of|at least)\s+(\d+)\b/i)?.[1];
    return `Parola uzunluğu için login/min_password_lng parametresini raporda önerilen${min ? ` en az ${min}` : ""} değere göre gözden geçirin.${notes}`;
  }
  if (has(/\b(?:high memory consumption|memory usage|effective allocation limit)\b/i) && has(/\b(?:index server|indexserver)\b/i))
    return "Indexserver'ın yüksek bellek tüketiminin nedenini araştırın. Bellek kullanımını azaltma veya SAP HANA kapasite boyutlandırmasını yeniden değerlendirme seçeneklerini inceleyin.";
  if (has(/\b(?:log backup|data backup|backup catalog)\b/i) && has(/\b(?:failed|failure|check|review|monitor|unsuccessful)\b/i))
    return "Raporda belirtilen yedekleme kayıtlarını ve başarısız işlemleri inceleyin. Kök nedeni belirlemek için ilgili yedekleme loglarını kontrol edin.";
  if (has(/\b(?:partitioning|non-partitioned|partitioned)\b/i) && has(/\b(?:table|tables|record|records|DVM|archiv|growth)\b/i))
    return "İlgili tabloların büyüme hızını ve application uyumluluğunu doğrulayın. Uygun tablolar için partitioning veya SAP Data Volume Management (DVM) ile arşivleme seçeneklerini değerlendirin.";
  if (has(/\b(?:expensive|slow|poor performing)\b/i) && has(/\b(?:SQL|statement|query)\b/i))
    return "Raporda işaretlenen SQL sorgularının maliyetini ve yürütme planını inceleyin. Değişiklikleri önce test sisteminde doğrulayın.";
  if (has(/\b(?:gateway error logs|error logs)\b/i) && has(/\b(?:monitor|review|periodically)\b/i))
    return "İlgili hata günlüklerini düzenli olarak kontrol edin; raporda belirtilen sorunlara yönelik aksiyon alın.";
  return null;
}

export type RecommendationDisplay = {
  kind: "translation" | "summary" | "source";
  turkish?: string;
  english: string;
  collapsedEnglish: boolean;
  sourcePreview?: string;
};

function recommendationSourcePreview(source: string, limit = 260): string {
  const firstBlock = source.split(/\n{2,}/).map((item) => item.trim()).find(Boolean) ?? source.trim();
  if (firstBlock.length <= limit) return firstBlock;
  const region = firstBlock.slice(0, limit + 1);
  const sentenceEnd = Math.max(region.lastIndexOf(". "), region.lastIndexOf("; "), region.lastIndexOf(": "));
  const wordEnd = region.lastIndexOf(" ");
  const split = sentenceEnd >= Math.floor(limit * 0.45) ? sentenceEnd + 1 : wordEnd >= Math.floor(limit * 0.65) ? wordEnd : limit;
  return `${firstBlock.slice(0, split).trim()}…`;
}

/** All English is actual SAP source. No generated pseudo-originals. */
export function recommendationDisplay(source: string, translated?: string, showTranslation = true): RecommendationDisplay {
  const english = source.trim();

  if (showTranslation && translated?.trim() && translated.trim() !== english) {
    const copy = recommendationCopy(english, translated);
    if (copy.english) return {
      kind: "translation", turkish: copy.primary, english: copy.english,
      collapsedEnglish: copy.english.length > 280,
    };
  }

  if (showTranslation) {
    const direct = recommendationCopy(english);
    if (direct.english) return {
      kind: "translation", turkish: direct.primary, english: direct.english,
      collapsedEnglish: direct.english.length > 280,
    };

    const blocks = english.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    if (blocks.length > 1) {
      const translatedBlocks = blocks.map((block) => recommendationCopy(block));
      if (translatedBlocks.every((item) => Boolean(item.english))) {
        return {
          kind: "translation",
          turkish: translatedBlocks.map((item) => item.primary).join("\n\n"),
          english,
          collapsedEnglish: true,
        };
      }
    }

    const summary = groundedRecommendationSummary(english);
    if (summary) return { kind: "summary", turkish: summary, english, collapsedEnglish: true };
  }

  const collapsedEnglish = english.length > 280;
  return {
    kind: "source",
    english,
    collapsedEnglish,
    sourcePreview: collapsedEnglish ? recommendationSourcePreview(english) : undefined,
  };
}
