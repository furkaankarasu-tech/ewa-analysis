/**
 * SAP/EWA presentation vocabulary. Keep identifiers and product names intact.
 * Only translate a complete heading or a clearly recognized source sentence;
 * never assemble a seemingly certain diagnosis from individual keywords.
 */
const headingTranslations: Readonly<Record<string, string>> = {
  "memory consumption of indexserver": "Indexserver bellek tüketimi",
  "memory consumption of tables": "Tabloların bellek tüketimi",
  "memory consumption": "Bellek tüketimi",
  "sap hana resource consumption": "SAP HANA kaynak kullanımı",
  "sap hana memory consumption": "SAP HANA bellek tüketimi",
  "high memory consumption": "Yüksek bellek tüketimi",
  "hardware capacity": "Donanım kapasitesi",
  "hardware capacity check": "Donanım kapasitesi kontrolü",
  "hardware capacity checks": "Donanım kapasitesi kontrolleri",
  "cpu utilization": "CPU kullanım oranı",
  "cpu utilization of the database server": "Veritabanı sunucusunun CPU kullanımı",
  "database response time": "Veritabanı yanıt süresi",
  "dialog response time": "Dialog yanıt süresi",
  "workload analysis": "Sistem iş yükü analizi",
  "performance overview": "Performans özeti",
  "program errors": "Program hataları",
  "program errors (abap dumps)": "Program hataları (ABAP kısa dökümleri)",
  "abap dumps": "ABAP kısa dökümleri",
  "database errors": "Veritabanı hataları",
  "database growth": "Veritabanı büyümesi",
  "database size": "Veritabanı boyutu",
  "size and growth": "Boyut ve büyüme",
  "disk usage": "Disk kullanımı",
  "data disk usage": "DATA diski kullanımı",
  "backup and recovery": "Yedekleme ve kurtarma",
  "backup configuration": "Yedekleme yapılandırması",
  "log backup": "Log yedeklemesi",
  "data backup": "Veri yedeklemesi",
  "failed log backups": "Başarısız log yedeklemeleri",
  "failed data backups": "Başarısız veri yedeklemeleri",
  "database consistency": "Veritabanı tutarlılığı",
  "global consistency check": "Genel tutarlılık kontrolü",
  "global consistency check run": "Genel tutarlılık kontrolünün çalıştırılması",
  "sql statement analysis": "SQL sorgu analizi",
  "sql statements": "SQL sorguları",
  "top sql statements": "En fazla kaynak tüketen SQL sorguları",
  "top statements (elapsed time)": "Toplam süresi en yüksek SQL sorguları",
  "missing indexes": "Eksik veritabanı indeksleri",
  "expensive statements": "Yüksek maliyetli SQL sorguları",
  "security": "Güvenlik",
  "security settings": "Güvenlik ayarları",
  "security checks": "Güvenlik kontrolleri",
  "system security": "Sistem güvenliği",
  "secure system internal communication": "Güvenli sistem içi iletişim",
  "message server security": "Message Server güvenliği",
  "message server access control list": "Message Server erişim kontrol listesi",
  "default passwords of standard users": "Standart kullanıcıların varsayılan parolaları",
  "abap password policy": "ABAP parola politikası",
  "password policy": "Parola politikası",
  "password complexity": "Parola karmaşıklığı",
  "validity of initial passwords": "İlk parolaların geçerlilik süresi",
  "users with critical authorizations": "Kritik yetkilere sahip kullanıcılar",
  "critical authorizations": "Kritik yetkiler",
  "audit configuration": "Denetim kaydı yapılandırması",
  "gateway administration": "Gateway yönetimi",
  "gateway error logs": "Gateway hata günlükleri",
  "system availability": "Sistem erişilebilirliği",
  "software configuration": "Yazılım yapılandırması",
  "software configuration for pfp": "PFP yazılım yapılandırması",
  "sap netweaver gateway": "SAP NetWeaver Gateway",
  "maintenance and update strategy for sap fiori front-end server": "SAP Fiori Front-End Server bakım ve güncelleme stratejisi",
  "sap fiori front-end server version": "SAP Fiori Front-End Server sürümü",
  "sap application release": "SAP uygulama sürümü",
  "maintenance phases": "Bakım dönemleri",
  "support package maintenance": "Support Package bakım durumu",
  "support package maintenance - java": "Java Support Package bakım durumu",
  "support package maintenance - abap": "ABAP Support Package bakım durumu",
  "security risk due to outdated support packages": "Güncelliğini yitiren Support Package sürümlerinden kaynaklanan güvenlik riski",
  "sap kernel release": "SAP Kernel sürümü",
  "software change management": "Yazılım değişiklik yönetimi",
  "transport errors": "Transport hataları",
  "transport sequence errors": "Transport aktarım sırası hataları",
  "failed changes": "Başarısız değişiklikler",
  "rfc response time": "RFC yanıt süresi",
  "trend analysis": "Eğilim analizi",
  "data volume management (dvm)": "Veri hacmi yönetimi (DVM)",
  "largest non-partitioned column tables (records)": "Bölümlere ayrılmamış en büyük sütun tabloları (kayıt sayısına göre)",
  "large non-partitioned tables": "Bölümlere ayrılmamış büyük tablolar",
  "critical number ranges": "Kritik numara aralıkları",
  "number ranges": "Numara aralıkları",
  "database server": "Veritabanı sunucusu",
  "java garbage collection": "Java bellek temizleme (garbage collection)",
  "abap stack of pfp": "PFP ABAP katmanı",
};

const normalizeHeading = (value: string) => value.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "").toLocaleLowerCase("en-US");

/** Whole-heading translation; handles qualified headings without losing SAP IDs. */
export function translatedSapHeading(value: string): string | null {
  const source = value.trim();
  const key = normalizeHeading(source);
  if (headingTranslations[key]) return headingTranslations[key];
  const indexServer = source.match(/^Memory Consumption of (Indexserver|Nameserver|Preprocessor|Compileserver|Statisticsserver)$/i);
  if (indexServer) return `${indexServer[1]} bellek tüketimi`;
  const growth = source.match(/^Growth of (Database|Tables|Log Volume)$/i);
  if (growth) {
    const translated: Record<string, string> = { database: "Veritabanı", tables: "Tablolar", "log volume": "Log alanı" };
    return `${translated[growth[1].toLowerCase()]} büyümesi`;
  }
  const trend = source.match(/^Trend Analysis for (RFC|Dialog|Database|CPU|Memory)$/i);
  if (trend) return `${trend[1]} eğilim analizi`;
  const scoped = source.match(/^(.+?)\s*>\s*(.+)$/);
  if (scoped) {
    const segments = source.split(/\s*>\s*/).map((part) => headingTranslations[normalizeHeading(part)] ?? part);
    if (segments.some((part, i) => part !== source.split(/\s*>\s*/)[i])) return segments.join(" › ");
  }
  return null;
}

/** Sentence templates are intentionally narrow and must preserve the measured value. */
export function translatedSapStatement(value: string): string | null {
  const source = value.trim().replace(/\s+/g, " ");
  if (/^The memory usage of the index server was very close to its effective allocation limit\.?$/i.test(source))
    return "Indexserver bellek kullanımı, kendisi için ayrılan bellek sınırına çok yaklaşmış.";
  if (/^No archiving (?:is )?(?:set up|configured)\.?$/i.test(source))
    return "Sistemde arşivleme yapılandırılmamış.";
  if (/^Only a lightweight consistency check is scheduled\.?$/i.test(source))
    return "Yalnızca sınırlı kapsamlı bir tutarlılık kontrolü planlanmış.";
  if (/^The (?:system|database) has already run out of maintenance\.?$/i.test(source))
    return "Sistemin veya veritabanının bakım desteği sona ermiş; ilgili ürünün destek durumunu doğrulayın.";
  const failed = source.match(/^There (?:were|are) (\d+) (?:unsuccessful|failed) (log|data) backups?\.?$/i);
  if (failed) return `${failed[1]} başarısız ${failed[2].toLowerCase() === "log" ? "log" : "veri"} yedeklemesi kaydedilmiş.`;
  const memory = source.match(/^The memory usage of the index server (?:has reached|reached) ([\d.,]+)% of its (?:effective )?allocation limit\.?$/i);
  if (memory) return `Indexserver bellek kullanımı, kendisi için ayrılan bellek sınırının %${memory[1]} değerine ulaşmış.`;
  return null;
}

/** Fix only well-identified mixed-language phrases in Radar's own text. */
export function polishRadarTurkish(value: string, field: "title" | "evidence" | "impact" | "cause" | "action"): string {
  if (!value.trim()) return "";
  let result = value.trim().replace(/\s+/g, " ")
    .replace(/DVM\s*\/\s*arşivleme/gi, "SAP Veri Hacmi Yönetimi (DVM) ile arşivleme")
    .replace(/\blog backup denemeleri\b/gi, "log yedekleme denemeleri")
    .replace(/\blog backup kaydı\b/gi, "log yedekleme kaydı")
    .replace(/\blog backup\b/gi, "log yedeklemesi")
    .replace(/\bbackup catalog\b/gi, "yedekleme kataloğu (Backup Catalog)")
    .replace(/\bglobal consistency check\b/gi, "genel tutarlılık kontrolü");
  if (field === "evidence") {
    result = result.replace(/^Instance (?=[\d.,]+\s*\/)/i, "HANA instance belleği: ");
    result = result.replace(/;\s*indexserver\s+(?=[\d.,]+\s*\/)/gi, "; indexserver belleği: ");
    result = result.replace(/\b(\d[\d.,]*)\s+dump\b/gi, "$1 ABAP kısa dökümü");
  }
  if (field === "title") {
    result = result.replace(/^ABAP dump yoğunluğu$/i, "ABAP kısa döküm yoğunluğu");
    result = result.replace(/^Transport sıra hatası$/i, "Transport aktarım sırası hatası");
    result = result.replace(/^Support Package güvenlik bakımı sona ermiş$/i, "Support Package güvenlik desteği sona ermiş");
  }
  return result;
}

/** Translate visible breadcrumbs only where the source heading is known;
 * keep the English EWA section path available unchanged for audit and proof. */
export function sapSourceLabel(original: string): string {
  const originalPath = original.trim();
  if (!originalPath) return "";
  const page = originalPath.match(/\s+·\s+s\.\s*\d+\s*$/i)?.[0] ?? "";
  const full = originalPath.slice(0, originalPath.length - page.length);
  const prefix = full.startsWith("Alert Overview · ") ? "Alarm özeti · " : "";
  const path = prefix ? full.slice("Alert Overview · ".length) : full;
  const sections = path.split(/\s*>\s*/);
  const labels = sections.map((part) => translatedSapHeading(part) ?? part);
  if (labels.every((label, index) => label === sections[index])) return prefix ? `${prefix}${path}${page}` : originalPath;
  return prefix + labels.join(" › ") + page;
}
