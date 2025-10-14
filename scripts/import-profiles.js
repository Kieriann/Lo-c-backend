// Exécuter : node scripts/import-profiles.js
const prisma = require('../src/utils/prismaClient');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// ── Helpers ────────────────────────────────────────────────────────
const normalizeTechs = (arr = []) =>
  arr
    .map(t =>
      typeof t === 'string'
        ? { name: t, level: 'intermediate' }
        : { name: t?.name ?? t?.label ?? t?.value ?? t?.tech ?? '', level: t?.level ?? 'intermediate' }
    )
    .filter(t => (t.name || '').trim() !== '');

const uniqBy = (arr, key) => {
  const seen = new Set();
  return arr.filter(o => (k => (seen.has(k) ? false : (seen.add(k), true)))(o[key].toLowerCase()));
};

function asJson(value, fallback = []) {
  if (value == null) return fallback;
  return value;
}
function toRates(tjm) {
  if (!tjm || isNaN(Number(tjm))) return { small: 0, medium: 0, high: 0 };
  const n = Number(tjm);
  return { small: Math.max(n - 50, 0), medium: n, high: n + 50 };
}

// ── Mappers ────────────────────────────────────────────────────────
function mapExperiences(p) {
  const items = Array.isArray(p.experiences) ? p.experiences : [];
  const langs = normalizeTechs(p.technologies).map(t => t.name).slice(0, 5);
  const skillsJoined = Array.isArray(p.skills) ? p.skills.join(', ') : '';
  return items.map(e => ({
    title: e.role || e.title || 'Expérience',
    client: e.company || e.client || '',
    description: e.desc || e.description || '',
    domains: 'Informatique',
    languages: langs,
    skills: skillsJoined,
  }));
}

function mapPrestations(p) {
  const techsFromTechnologies = normalizeTechs(p.technologies || []);
  const techsFromSkills = normalizeTechs(p.skills || []);
  const techs = uniqBy([...techsFromTechnologies, ...techsFromSkills], 'name');

  const labels = Array.isArray(p.prestations) ? p.prestations : [];
  const firstTech = techs[0]?.name || '';

  const fromLabels = labels.map(label => ({
    type: String(label),
    tech: firstTech,
    level: 'intermediate',
  }));

  const fromTechs = techs.map(t => ({
    type: 'tech',
    tech: t.name,
    level: t.level || 'intermediate',
  }));

  return [...fromLabels, ...fromTechs];
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const file = path.join(__dirname, '..', 'fixtures', 'profiles.json');
  if (!fs.existsSync(file)) {
    console.error('fixtures/profiles.json introuvable');
    process.exit(1);
  }

  const raw = fs.readFileSync(file, 'utf8');
  const cleaned = raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');
  const data = JSON.parse(cleaned);

  const defaultHash = await bcrypt.hash('Password123!', 10);

  for (const p of data) {
    try {
      // ── 1) USER ──────────────────────────────────────────────────
      let user = await prisma.user.findUnique({ where: { email: p.email } });
      if (!user) {
        user = await prisma.user.create({
          data: { email: p.email, username: p.email, password: defaultHash },
        });
      } else if (!user.username) {
        user = await prisma.user.update({
          where: { id: user.id }, data: { username: p.email },
        });
      }

      // ── 2) PROFILE (1-1 avec User) ───────────────────────────────
      let profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      const rates = toRates(p.tjm);

      if (!profile) {
        profile = await prisma.profile.create({
          data: {
            firstname: p.firstName || p.firstname || '',
            lastname: p.lastName || p.lastname || '',
            phone: p.phone || '',
            bio: p.bio || '',
            languages: asJson(p.languages, []), // JSON
            siret: p.siret || '',
            registrationNumber: p.registrationNumber || '',
            smallDayRate: rates.small,
            mediumDayRate: rates.medium,
            highDayRate: rates.high,
            teleworkDays: Number.isFinite(Number(p.teleworkDays ?? p.remoteDaysCount))
              ? Number(p.teleworkDays ?? p.remoteDaysCount) : 0,
            isEmployed: !!p.isEmployed,
            availableDate: p.availableFrom ? new Date(p.availableFrom) : null,
            website: p.website || null,
            workerStatus: 'indep',
            memberStatus: null,
            User: { connect: { id: user.id } },
          },
        });
      } else {
        profile = await prisma.profile.update({
          where: { userId: user.id },
          data: {
            firstname: p.firstName || p.firstname || profile.firstname || '',
            lastname: p.lastName || p.lastname || profile.lastname || '',
            phone: p.phone ?? profile.phone ?? '',
            bio: p.bio ?? profile.bio ?? '',
            languages: asJson(p.languages, profile.languages || []),
            siret: p.siret ?? profile.siret ?? '',
            registrationNumber: p.registrationNumber ?? profile.registrationNumber ?? '',
            smallDayRate: rates.small || profile.smallDayRate || 0,
            mediumDayRate: rates.medium || profile.mediumDayRate || 0,
            highDayRate: rates.high || profile.highDayRate || 0,
            teleworkDays: Number.isFinite(Number(p.teleworkDays ?? p.remoteDaysCount))
              ? Number(p.teleworkDays ?? p.remoteDaysCount) : (profile.teleworkDays ?? 0),
            isEmployed: !!(p.isEmployed ?? profile.isEmployed),
            availableDate: p.availableFrom ? new Date(p.availableFrom) : (profile.availableDate || null),
            website: p.website ?? profile.website ?? null,
          },
        });
      }

      // ── 3) ADDRESS (optionnelle) ─────────────────────────────────
      const hasAddressBits = p.addressLine || p.city || p.postalCode;
      if (hasAddressBits) {
        const existingAddr = await prisma.address.findUnique({ where: { profileId: profile.id } });
        if (!existingAddr) {
          await prisma.address.create({
            data: {
              profileId: profile.id,
              address: p.addressLine || '',
              city: p.city || '',
              state: p.state || '',
              country: p.country || 'France',
              postalCode: p.postalCode || '',
            },
          });
        } else {
          await prisma.address.update({
            where: { profileId: profile.id },
            data: {
              address: p.addressLine ?? existingAddr.address ?? '',
              city: p.city ?? existingAddr.city ?? '',
              state: p.state ?? existingAddr.state ?? '',
              country: p.country ?? existingAddr.country ?? 'France',
              postalCode: p.postalCode ?? existingAddr.postalCode ?? '',
            },
          });
        }
      }

      // ── 4) EXPERIENCES (User) ────────────────────────────────────
      const exps = mapExperiences(p);
      if (exps.length) {
        await prisma.experience.createMany({
          data: exps.map(e => ({ ...e, userId: user.id })),
          skipDuplicates: true,
        });
      }

      // ── 5) PRESTATIONS (User) ────────────────────────────────────
      const pres = mapPrestations(p);
      await prisma.prestation.deleteMany({ where: { userId: user.id } }); // reset
      if (pres.length) {
        await prisma.prestation.createMany({
          data: pres.map(x => ({ ...x, userId: user.id })),
          skipDuplicates: true,
        });
      }

      console.log('OK', p.email);
    } catch (e) {
      console.error('FAIL', p.email, e.message);
    }
  }
}

main()
  .catch(e => console.error('Fatal:', e))
  .finally(() => prisma.$disconnect());
