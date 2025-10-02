// Exécuter : node scripts/import-profiles.js
const prisma = require('../src/utils/prismaClient');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function asJson(value, fallback = []) {
  // Profile.languages est Json : on accepte [] ou [{lang,level}]
  if (value == null) return fallback;
  return value;
}

function toRates(tjm) {
  if (!tjm || isNaN(Number(tjm))) return { small: 0, medium: 0, high: 0 };
  const n = Number(tjm);
  return {
    small: Math.max(n - 50, 0),
    medium: n,
    high: n + 50,
  };
}

function mapExperiences(p) {
  // Experience appartient à User (pas au Profile)
  const items = Array.isArray(p.experiences) ? p.experiences : [];
  const skillsJoined = Array.isArray(p.skills) ? p.skills.join(', ') : '';
  return items.map((e) => ({
    title: e.role || e.title || 'Expérience',
    client: e.company || e.client || '',
    description: e.desc || e.description || '',
    domains: 'Informatique',
    languages: Array.isArray(p.technologies) ? p.technologies.slice(0, 5) : [],
    skills: skillsJoined,
  }));
}

function mapPrestations(p) {
  // Prestation { type, tech, level } rattachée au User
  const items = Array.isArray(p.prestations) ? p.prestations : [];
  const tech = Array.isArray(p.technologies) && p.technologies.length ? p.technologies[0] : '';
  return items.map((label) => ({
    type: String(label),
    tech,
    level: 'intermédiaire',
  }));
}

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
          data: {
            email: p.email,
            username: p.email,     // unique et simple
            password: defaultHash, // ton schéma n'a que "password"
          },
        });
      } else if (!user.username) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { username: p.email },
        });
      }

      // ── 2) PROFILE (1-1 avec User) ───────────────────────────────
      let profile = await prisma.profile.findUnique({ where: { userId: user.id } });
      if (!profile) {
        const rates = toRates(p.tjm);
        profile = await prisma.profile.create({
          data: {
            firstname: p.firstName || p.firstname || '',
            lastname: p.lastName || p.lastname || '',
            phone: p.phone || '',
            bio: p.bio || '',
            languages: asJson(p.languages, []), // Json
            siret: p.siret || '',
            registrationNumber: p.registrationNumber || '',
            smallDayRate: rates.small,
            mediumDayRate: rates.medium,
            highDayRate: rates.high,
            teleworkDays: Number.isInteger(p.remoteDaysCount) ? p.remoteDaysCount : 0,
            isEmployed: !!p.isEmployed,
            availableDate: p.availableFrom ? new Date(p.availableFrom) : null,
            website: p.website || null,
            workerStatus: 'indep',
            memberStatus: null,
            User: { connect: { id: user.id } },
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
        }
      }

      // ── 4) EXPERIENCES (rattachées au User) ──────────────────────
      const exps = mapExperiences(p);
      if (exps.length) {
        await prisma.experience.createMany({
          data: exps.map((e) => ({ ...e, userId: user.id })),
          skipDuplicates: true,
        });
      }

      // ── 5) PRESTATIONS (rattachées au User) ──────────────────────
      const pres = mapPrestations(p);
      if (pres.length) {
        await prisma.prestation.createMany({
          data: pres.map((x) => ({ ...x, userId: user.id })),
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
  .catch((e) => console.error('Fatal:', e))
  .finally(() => prisma.$disconnect());
