

### QR nuskaitymo pataisymas (2026-10)
Jei kamera atpažįsta QR kodą, bet likutis nepasikeičia, Supabase SQL Editor paleiskite failo `supabase/migration_2026_10_qr_stock_fix.sql` turinį. Taip atnaujinama duomenų bazės funkcija, kuri pagal QR etiketėje esantį prekės kodą sumažina foto popieriaus likutį vienu vienetu ir įrašo veiksmą į istoriją. QR skenavimui būtina būti prisijungus administratoriaus paskyra.

Ši versija pašalina viršutinį skaitmeninį laikrodį, sutankina lenteles ir telefono ekrane nebeturėtų reikėti horizontaliai slinkti per medžiagų lenteles. Sandėlio veiksmuose liko vienas punktas „Likučių koregavimas“, kuriame galima pasirinkti „Pridėti“, „Atimti“ arba „Koreguoti“.

## 2026-10-31 atnaujinimas: greitas QR nuskaitymas telefonu

- QR etiketėje dabar užkoduota tiesioginė svetainės nuoroda su prekės kodu (`?scan=...`).
- Nuskenavus QR įprasta telefono kamera, svetainė atsidaro naršyklėje ir automatiškai bando sumažinti foto popieriaus likutį vienu vienetu.
- Veiksmas leidžiamas tik prisijungusiu administratoriaus naudotoju. Duomenų bazės `scan_stock` funkcija tikrina administratoriaus teises; neprisijungusiam ar ne administratoriui likutis nepasikeičia.
- Svarbu: reikia iš naujo atsispausdinti QR etiketes, nes senose etiketėse užkoduotas tik prekės kodas, o ne svetainės nuoroda.
- Telefonas turi atidaryti tą pačią naršyklę, kurioje administratorius jau prisijungęs. Jei kamera atidaro kitą naršyklę arba kitame telefone nėra administratoriaus sesijos, sistema atmes nuskaitymą.
- QR etiketę generuokite jau paskelbtoje svetainėje, kad nuorodoje būtų tikras svetainės domenas, o ne `localhost`.
