/** Offline, whole-sentence SAP templates. Captured identifiers and measurements
 * are copied verbatim; unknown clauses are never guessed or removed. */
export function sapRuleTranslation(source: string): string | null {
  const text = source.trim().replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(\d+) ABAP dumps have been recorded in your system in the period (\d{2}\.\d{2}\.\d{4}) to (\d{2}\.\d{2}\.\d{4})\.?$/i)))
    return `${m[2]}–${m[3]} döneminde sisteminizde ${m[1]} ABAP dump kaydı oluşmuş.`;
  if ((m = text.match(/^We found more than (\d+) ABAP dumps in your system\.?$/i))) return `Sistemde ${m[1]} adetten fazla ABAP dump kaydı bulunmuş.`;
  if ((m = text.match(/^(?:The )?[Pp]rofile parameter ([a-z][a-z0-9_./-]*) is not set to ([A-Za-z0-9_.-]+)\.?$/)))
    return `${m[1]} profil parametresi ${m[2].replace(/\.$/, '')} olarak ayarlanmamış.`;
  if ((m = text.match(/^(?:The )?[Pp]rofile parameter ([a-z][a-z0-9_./-]*) should be set to ([A-Za-z0-9_.-]+)\.?$/)))
    return `${m[1]} profil parametresi ${m[2].replace(/\.$/, '')} olarak ayarlanmalıdır.`;
  if ((m = text.match(/^Assign a minimum value of (\d+) to the profile parameter ([a-z][a-z0-9_./-]*)\.?$/i)))
    return `${m[2].replace(/\.$/, '')} profil parametresini en az ${m[1]} olarak ayarlayın.`;
  if ((m = text.match(/^Set (?:the )?(?:profile )?parameter ([a-z][a-z0-9_./-]*) to ([A-Za-z0-9_.-]+)\.?$/i)))
    return `${m[1]} parametresini ${m[2].replace(/\.$/, '')} olarak ayarlayın.`;
  if ((m = text.match(/^The current value of (?:parameter )?([a-z][a-z0-9_./-]*) is ([A-Za-z0-9_.-]+)\.?$/i)))
    return `${m[1]} parametresinin mevcut değeri ${m[2].replace(/\.$/, '')}.`;
  if ((m = text.match(/^SAP HANA database:\s*Memory consumption of tables exceeds ([\d.,]+)% of usable memory\.?$/i)))
    return `SAP HANA tablolarının bellek tüketimi, kullanılabilir belleğin %${m[1]}'ini aşıyor.`;
  if ((m = text.match(/^There (?:were|are) (\d+) (?:unsuccessful|failed) (log|data) backups?\.?$/i)))
    return `${m[1]} başarısız ${m[2].toLowerCase() === 'log' ? 'log' : 'veri'} yedeklemesi var.`;
  if ((m = text.match(/^The table ([A-Z0-9_./]+) contains ([\d.,]+) records\.?$/)))
    return `${m[1]} tablosunda ${m[2]} kayıt bulunuyor.`;
  if ((m = text.match(/^([\d.,]+)% of (?:the )?number range ([A-Z0-9_/-]+) (?:is|has been) used\.?$/i)))
    return `${m[2]} numara aralığının %${m[1]}'i kullanılmış.`;
  if ((m = text.match(/^Remove the ([A-Z][A-Z_ ]+) privilege from all user accounts except (?:the )?SYSTEM (?:and|und) _SYS_REPO users\.?$/)))
    return `SYSTEM ve _SYS_REPO kullanıcıları dışındaki tüm kullanıcı hesaplarından ${m[1]} yetkisini kaldırın.`;
  if ((m = text.match(/^(?:For (?:more )?(?:details|information),? (?:see|refer to)|See) (https?:\/\/\S+?)(?: for (?:further|more) information)?\.?$/i)))
    return `Ayrıntılar için ${m[1]} adresine bakın.`;
  return null;
}
