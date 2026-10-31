

### QR nuskaitymo pataisymas (2026-10)
Jei kamera atpažįsta QR kodą, bet likutis nepasikeičia, Supabase SQL Editor paleiskite failo `supabase/migration_2026_10_qr_stock_fix.sql` turinį. Taip atnaujinama duomenų bazės funkcija, kuri pagal QR etiketėje esantį prekės kodą sumažina foto popieriaus likutį vienu vienetu ir įrašo veiksmą į istoriją. QR skenavimui būtina būti prisijungus administratoriaus paskyra.

Ši versija pašalina viršutinį skaitmeninį laikrodį, sutankina lenteles ir telefono ekrane nebeturėtų reikėti horizontaliai slinkti per medžiagų lenteles. Sandėlio veiksmuose liko vienas punktas „Likučių koregavimas“, kuriame galima pasirinkti „Pridėti“, „Atimti“ arba „Koreguoti“.
