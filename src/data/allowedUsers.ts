export interface AllowedUser {
  nik: string;
  name: string;
  line: string;
}

export const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1urZa6DYXMGtcS39KsLq2nNIPxmL2Z1OcEYMcxNOHyHE/gviz/tq?tqx=out:csv&gid=0';

export const DEFAULT_ALLOWED_USERS: AllowedUser[] = [
  { nik: 'MGM 1973', name: 'Suprihati', line: 'A01' },
  { nik: 'MGM 9689', name: 'Aprilina Fameliawati', line: 'A02' },
  { nik: 'MGM 9951', name: 'Lilik Nur Sagita', line: 'A03' },
  { nik: 'MGM 3062', name: 'Wahyuni', line: 'A04' },
  { nik: 'MGM 1076', name: 'Epimea Sri Suyanti', line: 'A05' },
  { nik: 'MGM 5000', name: 'Enny Yuliana', line: 'A06' },
  { nik: 'MGM 10812', name: 'Eka Gerhana Wulansari', line: 'A07' },
  { nik: 'MGM 4076', name: 'Ike Purnamasari', line: 'A08' },
  { nik: 'MGM 326', name: 'Rika Zulianti', line: 'A09' },
  { nik: 'MGM 9212', name: 'Ery Dwi Widayanti', line: 'A10' },
  { nik: 'MGM 2322', name: 'Nanik Erlina', line: 'A11' },
  { nik: 'MGM 5228', name: 'Nurhayati', line: 'A12' },
  { nik: 'MGM 6412', name: 'Tessya Ayu Amarta', line: 'A13' },
  { nik: 'MGM 3460', name: 'Vian Anggraeni', line: 'A14' },
  { nik: 'MGM 2126', name: 'Erlika Novita Sari', line: 'A15' },
  { nik: 'MGM 5450', name: 'Cristina Yolanda Lucky Martavianis', line: 'A16' },
  { nik: 'MGM 10264', name: 'Zhuhria Islami Martunus', line: 'A17' },
  { nik: 'MGM 14490', name: 'Yuliana Putri', line: 'A17' },
  { nik: 'MGM 14525', name: 'Siti Latifah', line: 'A17' },
  { nik: 'MGM 6855', name: 'Putri Fajar Astuti', line: 'A18' },
  { nik: 'MGM 13615', name: 'Dalila Fadhil Afifa', line: 'A19' },
  { nik: 'MGM 13740', name: 'Aika Khoirotun Nisa', line: 'A20' },
  { nik: 'MGM 13644', name: 'Listia Rahmayanti', line: 'A21' },
  { nik: 'MGM 13043', name: 'Sabrina Pratiwi', line: 'A25' },
  { nik: 'MGM 14294', name: 'Elly Agustina', line: 'A25' },
  { nik: 'MGM 13855', name: 'Anggi Muji Saputra', line: 'A26' },
  { nik: 'MGM 14092', name: 'Intan Rahayu', line: 'A27' },
  { nik: 'MGM 3446', name: 'Istikomah', line: 'B01' },
  { nik: 'MGM 8491', name: 'Olivia Karmila', line: 'B02' },
  { nik: 'MGM 5422', name: 'Indah Agustina Aryanto', line: 'B03' },
  { nik: 'MGM 10843', name: 'Eva Ayu Oktaviani', line: 'B04' },
  { nik: 'MGM 9151', name: 'Ulfa Ainia Kusumasari', line: 'B07' },
  { nik: 'MGM 1611', name: 'Tariyah', line: 'B08' },
  { nik: 'MGM 1264', name: 'Al Fatimah', line: 'B09' },
  { nik: 'MGM 13424', name: 'Fania Agustina', line: 'B10' },
  { nik: 'MGM 6800', name: 'Nurani Prassuci', line: 'B11' },
  { nik: 'MGM 11799', name: 'Merry Oktavia', line: 'B12' },
  { nik: 'MGM 6328', name: 'Rodhiyah', line: 'B12' },
  { nik: 'MGM 10845', name: 'Reekha Amelia', line: 'B13' },
  { nik: 'MGM 8290', name: 'Yuni Arifah', line: 'B14' },
  { nik: 'MGM 12786', name: 'Puspa Kartika Sari', line: 'B15' },
  { nik: 'MGM 8566', name: 'Sri Utami', line: 'B15' },
  { nik: 'MGM 5061', name: 'Ayu Lestari', line: 'B16' },
  { nik: 'MGM 12951', name: 'Feby Dian Marliya', line: 'B17' },
  { nik: 'MGM 12867', name: 'Tika Widya Aprilia', line: 'B18' },
  { nik: 'MGM 14269', name: 'Eko Puji Hastuti', line: 'B19' },
  { nik: 'MGM 10148', name: 'Siti Wakhid Dati', line: 'B05' },
  { nik: 'MGM 1903', name: 'Ruwiyati Maghfiroh', line: 'C01' },
  { nik: 'MGM 4323', name: 'Puji Lestari', line: 'C02' },
  { nik: 'MGM 7534', name: 'Tutik Fidia Ningrum', line: 'C03' },
  { nik: 'MGM 1463', name: 'Rosa Ayudya Falma Aprila', line: 'C04' },
  { nik: 'MGM 6938', name: 'Setia Ambar Winarti', line: 'C05' },
  { nik: 'MGM 1200', name: 'Istika Khaerani', line: 'C09' },
  { nik: 'MGM 3695', name: 'Siti Syariah', line: 'C10' },
  { nik: 'MGM 2517', name: 'Desi Fatmawati', line: 'C11' },
  { nik: 'MGM 4102', name: 'Erin Ruliyanti', line: 'D01' },
  { nik: 'MGM 3465', name: "Mu'linatus Sa'adah", line: 'D02' },
  { nik: 'MGM 4632', name: 'Ressya Deva Clerata', line: 'D03' },
  { nik: 'MGM 10542', name: 'Rizky Khurnia Rahmawati', line: 'D04' },
  { nik: 'MGM 3259', name: 'Deny Tri Yana Sari', line: 'D05' },
  { nik: 'MGM 8403', name: 'Dewie Puspa Ningrum', line: 'D07' },
  { nik: 'MGM 12896', name: 'Ulul Azmi', line: 'D09' },
  { nik: 'MGM 12749', name: 'Nadya Arsita', line: 'D10' },
  { nik: 'MGM 1942', name: 'Maryani Fauziyah', line: 'D11' },
  { nik: 'MGM 10329', name: 'Ika Mustika Rini', line: 'D12' },
  { nik: 'MGM 14437', name: 'Indra Widya Vinnana', line: 'D14' },
  { nik: 'MGM 9370', name: 'Febriana Avina C', line: 'Owner' },
];

/**
 * Normalizes NIK for string comparison.
 * e.g. "9370" -> "9370", "MGM 9370" -> "9370", "mgm 9370 " -> "9370"
 */
export function normalizeNik(nikStr: string): string {
  if (!nikStr) return '';
  return nikStr.toUpperCase().replace(/^MGM\s*/, '').trim();
}

/**
 * Validates whether an input NIK exists in the user list.
 */
export function validateUserNik(
  inputNik: string,
  userList: AllowedUser[] = DEFAULT_ALLOWED_USERS
): AllowedUser | null {
  const cleanInput = normalizeNik(inputNik);
  if (!cleanInput) return null;

  return (
    userList.find((u) => {
      const cleanUserNik = normalizeNik(u.nik);
      return cleanUserNik === cleanInput;
    }) || null
  );
}

/**
 * Helper to fetch live CSV from Google Sheet
 */
export async function fetchLiveAllowedUsers(): Promise<AllowedUser[]> {
  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!res.ok) throw new Error('Network error');
    const text = await res.text();
    const lines = text.trim().split('\n');
    const parsed: AllowedUser[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // CSV regex to match "val","val","val"
      const match = line.match(/"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/);
      if (match) {
        parsed.push({
          nik: match[1].trim(),
          name: match[2].trim(),
          line: match[3].trim(),
        });
      }
    }

    if (parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to fetch live Google Sheet users, using fallback list:', err);
  }
  return DEFAULT_ALLOWED_USERS;
}
