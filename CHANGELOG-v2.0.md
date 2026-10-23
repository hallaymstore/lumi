# Lumi 2.0 — Neo

## Dizayn
- Yangi `public/css/lumi-neo.css` (oxirgi yuklanadi): binafsha aurora fon, shisha (glass) topbar/bottom-nav/sheet, pill feed tablari, gradient story halqalari, ko'tarilgan "+" tugmasi, dark (default) + light.
- Mobil topbar pastga skrollda yashirinadi; kichik ekranda qo'shimcha ikonlar "yana" menyusiga yig'iladi.
- lucide endi o'zimizdan xizmat qilinadi (`/vendor/lucide-0.468.0.min.js`), unpkg/CSP bog'liqligi olib tashlandi.

## Feed
- `services/feedRank.js`: sifat + yangilik + qiziqish + kuzatuv signali, muallif/mavzu takrorini oldini oluvchi `arrange`, har 5-slotda exploration.
- Cheksiz skroll (`/api/feed/page`), keyingi postlar va rasm/videolar oldindan yuklanadi, Back bosganda aynan o'sha joyga qaytadi.
- Postda aniq vaqt (`.post-time`), skeleton, xato holatida "qayta urinish".

## Clips
- To'liq ekran, snap-scroll, faqat ko'rinib turgan klip o'ynaydi (autoplay, ovoz tanlovi eslab qolinadi), keyingi 2 klip oldindan yuklanadi, uzoqlari bo'shatiladi.
- Bir marta bosish = pauza, ikki marta bosish = like, seek bar, tezlik/subtitr/PiP/fullscreen menyusi.
- Ranking: ko'rish davomiyligi (retention) bo'yicha `clipStats`.

## Tuzatishlar
- Reklama: network cap ikki marta sanalishi tuzatildi; kontent yangilanganda reklama/video/karusel qayta bog'lanadi (`Lumi.onMount`).
- "Qiziq emas" / "muallifni kamaytirish" kartani to'g'ri olib tashlaydi.
- Feed to'xtatilgan (`isSuspended`) mualliflarni ko'rsatmaydi.
- `prefers-reduced-motion` yoqilgan bo'lsa avtoplay va animatsiyalar o'chiq qoladi.
