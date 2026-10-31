# Foto laboratorijos sandėlio sistema

Tai pirmas veikiantis MVP variantas: prisitaikantis prie telefono ir kompiuterio ekranų, vieša likučių peržiūra, administratoriaus prisijungimas, prekių pridėjimas, likučių koregavimas, QR skenavimas ir pakeitimų istorija.

## Svarbu prieš pradedant

- Reikės nemokamos „Supabase“ duomenų bazės ir „Cloudflare Pages“ talpinimo.
- QR skenavimui telefone būtinas HTTPS (Cloudflare Pages jį suteikia) ir leidimas naudoti kamerą.
- Tik prisijungęs vartotojas, įtrauktas į `admins` lentelę, galės keisti duomenis.
- Vieši lankytojai gali matyti likučius ir istoriją, bet negali keisti sandėlio.
- Demonstracinis režimas be `.env` rodo pavyzdinius duomenis, tačiau pakeitimai neišsaugomi.

## 1. Sukurkite Supabase duomenų bazę

1. Atidarykite https://supabase.com ir susikurkite projektą.
2. Užsirašykite duomenų bazės slaptažodį saugioje vietoje.
3. Projekto lange atidarykite **SQL Editor** → **New query**.
4. Atidarykite šiame projekte `supabase/schema.sql`, nukopijuokite visą turinį į SQL Editor ir spauskite **Run**.
5. SQL sukurs lenteles, saugumo taisykles ir 12 pradinių foto medžiagų pozicijų.

## 2. Sukurkite administratoriaus paskyrą

1. Supabase atidarykite **Authentication** → **Users** → **Add user**.
2. Įveskite įmonės administratoriaus el. paštą ir stiprų slaptažodį.
3. Sukūrus vartotoją, atidarykite **SQL Editor** ir vykdykite šią užklausą, pakeitę el. paštą tikruoju:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'admin@jusu-imone.lt'
on conflict (user_id) do nothing;
```

4. Viešame puslapyje prisijunkite per „Administratoriaus prisijungimas“.
5. Niekada nekelkite `service_role` rakto į svetainės kodą. Frontendui naudojamas tik `anon` / publishable raktas.

## 3. Paleiskite kompiuteryje testavimui

Reikės įsidiegti Node.js LTS versiją iš https://nodejs.org ir Git iš https://git-scm.com/downloads.

1. Išarchyvuokite `foto-laboratorijos-sandelis.zip`.
2. Aplanke nukopijuokite `.env.example` į naują failą pavadinimu `.env`.
3. Supabase projekte eikite į **Project Settings** → **API** (arba **Connect**) ir nusikopijuokite Project URL bei anon/publishable key.
4. `.env` faile įrašykite:

```env
VITE_SUPABASE_URL=https://JUSU-PROJEKTO-ID.supabase.co
VITE_SUPABASE_ANON_KEY=JUSU_SUPABASE_ANON_RAKTAS
```

5. Atidarykite terminalą tame aplanke ir paleiskite:

```bash
npm install
npm run dev
```

6. Terminalas parodys vietinį adresą, dažniausiai `http://localhost:5173`. Atidarykite jį naršyklėje.

## 4. Įkelkite į GitHub

1. GitHub sukurkite naują **Private** arba **Public** repository, pvz. `foto-laboratorijos-sandelis`.
2. Įkelkite visus projekto failus, bet **nekelkite `.env` failo**. Jame yra viešai neskirtų konfigūracijos reikšmių.
3. Įsitikinkite, kad įkėlėte `package.json`, `index.html`, `src/`, `supabase/schema.sql`, `README_LT.md` ir `.gitignore`.

Jei naudosite Git terminalą:

```bash
git init
git add .
git commit -m "Pradinis foto laboratorijos sandelio projektas"
git branch -M main
git remote add origin https://github.com/JUSU-VARDAS/foto-laboratorijos-sandelis.git
git push -u origin main
```

## 5. Publikuokite per Cloudflare Pages

1. Atidarykite https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pasirinkite GitHub repository.
3. Build nustatymai:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Prie **Environment variables** pridėkite:
   - `VITE_SUPABASE_URL` = jūsų Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = jūsų anon/publishable raktas
5. Spauskite **Save and Deploy**.
6. Cloudflare suteiks adresą, pvz. `https://...pages.dev`. Atidarykite jį telefone ir kompiuteryje.
7. Po kiekvieno GitHub pakeitimo Cloudflare Pages automatiškai iš naujo sukurs svetainę.

## 6. Kaip testuoti

1. Atidarykite puslapį be prisijungimo: turi matytis likučiai, užsakomos medžiagos ir istorija, bet neturi būti leidžiama keisti duomenų.
2. Prisijunkite administratoriaus paskyra.
3. Patikrinkite „Pridėti prekę“ ir sukurkite bandomąją poziciją su unikaliu kodu.
4. Patikrinkite „Pridėti likutį“, „Atimti likutį“ ir „Koreguoti likutį“. Visi veiksmai turi atsirasti istorijoje.
5. QR testas: sukurkite QR kodą, kurio turinys yra tikslus prekės kodas (pvz. `FP-G152`). Atidarykite svetainę telefone, prisijunkite, pasirinkite **QR nuskaitymas** ir nuskenuokite. Kiekis turi sumažėti tiksliai 1, ne daugiau.
6. Kai likutis mažesnis už minimalų, pozicija turi būti rodoma „Užsakomos medžiagos“ skiltyje. Kai likutis lygus minimumui, ji neturi būti rodoma.
7. Patikrinkite, kad cheminės medžiagos palaiko trupmeninius kiekius, pvz. `1,5` bako.
8. Patikrinkite telefoną siaurame ekrane. Navigacija apačioje perjungia kategorijas, o sandėlio veiksmai yra šoniniame meniu.

## QR etikečių pastaba

QR kodas turi užkoduoti tik prekės `code` reikšmę, be papildomo teksto ar nuorodos. Tas pats kodas gali būti spausdinamas ant tos pačios medžiagos pakuočių. Kiekvienas sėkmingas nuskaitymas sumažina likutį vienu vienetu. Šiuo metu QR skeneris veikia kameros režimu; atskiras spausdinamų QR etikečių puslapis ir brūkšninių kodų spausdinimo šablonai yra logiškas kitas etapas.

## Šio MVP ribos

- Nustatymų ir išsamių ataskaitų meniu dar yra baziniai.
- Administratoriui prie prekių yra QR etiketės peržiūra ir spausdinimas; QR kode įrašomas tik unikalus prekės kodas.
- Pakeitimų istorijos lange šiuo metu rodomi paskutiniai 12 įrašų.
- Administratoriaus vaidmuo priskiriamas per Supabase `admins` lentelę.
- Prieš realų įmonės naudojimą rekomenduojama išbandyti su keliomis bandomosiomis prekėmis ir patikrinti teises dviejose naršyklėse.

## Failų struktūra

```text
foto-laboratorijos-sandelis/
├── index.html
├── package.json
├── .env.example
├── README_LT.md
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
└── supabase/
    └── schema.sql
```
