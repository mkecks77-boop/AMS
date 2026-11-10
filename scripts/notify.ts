/** Fristen-E-Mails manuell oder per Cron versenden: npm run notify */
import { sendDigests } from "../src/lib/digest";
import { db } from "../src/lib/db";

sendDigests()
  .then((r) => console.log(`Fristen-E-Mails: ${r.sent} versendet, ${r.skipped} nicht versendet (siehe Versandprotokoll).`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
