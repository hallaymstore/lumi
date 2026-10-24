# LumiCoin v2.1 — virtual kosmetika marketi

## Foydalanish
- Kirgan foydalanuvchi /market sahifasidan boshlaydi.
- Coinlar pul emas, boshqa foydalanuvchiga o'tkazilmaydi va qaytarib olinmaydi.
- 5 ramka: Aurora 90, Royal 180, Fire 150, Frost 120, Galaxy 240.
- Qo'shimcha: 4 badge, 3 nickname nameplate, 3 chat bubble, 3 profile theme, 2 effect.
- Xarid qiling -> Qo'llash. Bitta toifadagi faqat bitta item faol bo'ladi.
- Decorlar feed, profile, comment, chat-list va chat-headerda; chat bubble xabarlarida ishlaydi.

## Server himoyasi
- Balans mijoz JavaScriptidan emas, faqat real backend eventlardan oshadi.
- MongoDB replica-set transactions bilan ledger/wallet/inventory atomik saqlanadi.
- Reward faqat telefon tasdiqlangan, organik va platforma boshqarmaydigan profilga beriladi.
- Har bir reward event noyob eventKey va UTC kunlik cap bilan chegaralangan.
- 10 qualified view = 5 coin: faqat real, tasdiqlangan, boshqa foydalanuvchidan bir martalik ko'rish.
- Bot/synthetic profillar, o'z postini ko'rish, qayta-qayta like/follow qo'shimcha coin bermaydi.
- Birinchi marta /market ochilsa, eligible userga 25 coin bonus.
- Virtual kosmetikani sotish real pul orqali emas; Google Play Billing talab qiladigan pulli virtual mahsulotlarni shu bilan aralashtirmang.
- Hisoblar uchun /api/lumicoin private no-store; POST /market/buy/:id va /market/equip/:group/:id same-origin sessiya bilan himoyalangan.

## Earn rules (UTC kunlik limit)
welcome +25 (1 marta), upload +20 (3), like +1 (10), comment +3 (8), follow +3 (5),
received_like +2 (30), received_comment +4 (20), received_follow +5 (20),
views_10 +5 (60).

## Ishga tushirish / QA
1. MongoDB Atlas replica set mavjudligini tekshiring (standalone MongoDB transactionni qo'llamaydi).
2. npm ci && npm run check && npm run check:views && node --test test/*.test.js
3. Ikki-uchta real test akkauntida telefon tasdiqlash, welcome reward va event rewardlarini tekshiring.
4. Bir xil like/foIlow va ko'rishni takrorlang: coin ikki marta tushmasligi kerak.
5. Yetarli coin bo'lmaganda xaridni, bitta itemni qayta xaridni, parallel xaridni sinang.
6. Komment, chat va postdagi avatar ramkasini Android WebViewda ko'ring.
7. Feed inline autoplayni Android 11+ va mobil Chrome'da (Wi-Fi, 4G, data saver), Clips swipe ni ham tekshiring.
8. Deploydan oldin rollback va zaxira rejasi bo'lsin.
