# KHQR Payment + Auto Transaction Check

ប្រព័ន្ធបង្កើត KHQR និងពិនិត្យការទូទាត់ដោយស្វ័យប្រវត្តិ តាម **Bakong Open API** (មិនប្រើ ABA Merchant ID)។

**Stack:** Node.js + Express · MongoDB + Mongoose · HTML/CSS/JS សុទ្ធ (ក្នុង `public/`) · JavaScript សុទ្ធ (គ្មាន Python)

## លំហូរការងារ

1. អ្នកប្រើបញ្ចូលចំនួនទឹកប្រាក់ → `POST /api/payment/create`
2. Server បង្កើត Order + **Dynamic KHQR** (មានចំនួនទឹកប្រាក់ និងពេលផុតកំណត់) ដោយប្រើ SDK ផ្លូវការ `bakong-khqr` ហើយរក្សាទុក `md5` ក្នុង MongoDB
3. អ្នកប្រើស្កេន QR ដោយកម្មវិធីធនាគារ ហើយបង់ប្រាក់
4. Server ពិនិត្យ `POST /v1/check_transaction_by_md5` (Bakong Open API) ដោយប្រើ Token ដែលស្ថិតនៅលើ Server តែប៉ុណ្ណោះ
5. មុនកំណត់ `PAID` Server ផ្ទៀងផ្ទាត់៖ **ចំនួនទឹកប្រាក់ · រូបិយប័ណ្ណ · គណនីទទួលប្រាក់ · ពេលវេលា**
6. ការប្តូរស្ថានភាព `PENDING → PAID` ជា **Atomic Update** + `transaction.hash` ជា Unique Index → ការទូទាត់ស្ទួន និងការផ្ដល់ផលិតផលស្ទួនមិនអាចកើតមាន

ស្ថានភាព៖ `PENDING` · `PAID` · `EXPIRED` · `FAILED` (បង់ហើយតែមិនត្រូវនឹង Order → ត្រូវពិនិត្យដោយដៃ)

## API

| Method | Path | ការងារ |
|---|---|---|
| GET | `/api/health` | ពិនិត្យ Server + Database + ការកំណត់ (បង្ហាញតែឈ្មោះ Variable ដែលខ្វះ) |
| POST | `/api/payment/create` | បង្កើត Order + KHQR · body: `{ "amount": "10000", "currency": "KHR" }` |
| GET | `/api/payment/status/:orderId` | អានស្ថានភាពពី DB (មិនហៅ Bakong) |
| GET | `/api/payment/order/:orderId` | យក Order + QR ឡើងវិញ (ក្រោយ Refresh ទំព័រ) |
| POST | `/api/payment/check/:orderId` | ឱ្យ Server ពិនិត្យ Bakong (កំណត់ម្ដងក្នុង `CHECK_MIN_INTERVAL_SECONDS` ក្នុងមួយ Order) |

## ការពារ Request ហួសកម្រិត

- Rate limit ក្នុងមួយ IP (create 10/នាទី · check 40/នាទី)
- កំណត់ Order ដែលកំពុងរង់ចាំ ក្នុងមួយ IP (`MAX_PENDING_PER_IP`)
- ក្នុងមួយ Order ហៅ Bakong យ៉ាងច្រើនម្ដងក្នុង ~4 វិនាទី **សរុបគ្រប់ Client** (claim ដោយ MongoDB atomic update)
- Frontend ធ្វើ Polling ជា ~4វិ (15វិ ពេលផ្ទាំងលាក់) ហើយថយក្រោយ (backoff) ពេលមានកំហុស

## Render vs Vercel (មិនដូចគ្នា)

| | Render (`render.yaml`) | Vercel (`vercel.json`) |
|---|---|---|
| ប្រភេទ | Server រត់ជាប់ជានិច្ច | Serverless Function |
| Background polling | ✅ `BACKGROUND_POLLING=true` ពិនិត្យតាម Server ទោះបិទ Browser | ❌ មិនអាច · ពឹងលើ Browser Polling |
| Rate-limit store | មួយ Instance (ត្រឹមត្រូវ) | ក្នុង Memory ក្នុងមួយ Instance (ខ្សោយជាង); ការកំណត់ Pending ក្នុងមួយ IP ប្រើ DB ដូច្នេះនៅតែដំណើរការ |
| Cold start | Free plan ដេកក្រោយអសកម្ម | មាន Cold start តូចៗ |

ព័ត៌មានលម្អិត៖ អាន **[deploy.md](./deploy.md)**

## ចាប់ផ្តើមលឿន

```bash
npm install
cp .env.example .env     # បំពេញតម្លៃរបស់អ្នក (មើល deploy.md)
npm start                # http://localhost:5000
npm test                 # Unit tests (Mock · មិនហៅ Bakong ពិត)
```

## ចំណុចផ្ដល់ផលិតផល / Token

កែ `src/services/fulfillment.js` → `onOrderPaid(order)`។ វាត្រូវបានហៅ **យ៉ាងច្រើនម្ដងក្នុងមួយ Order**។

## ស្ថានភាពការផ្ទៀងផ្ទាត់ (សូមអាន)

- ✅ Unit tests (Mock) ឆ្លងកាត់៖ ការ Validate, ក្បួនផ្ទៀងផ្ទាត់ទូទាត់, Bakong client (Mock `fetch`: 401/403/429/5xx, Timeout, Not found, Response ខូច)
- ⚠️ **មិនទាន់បានសាកល្បងជាមួយ Bakong API ពិត ឬ Token ពិត** ដូច្នេះ Auto Transaction Check មិនទាន់ត្រូវបានបញ្ជាក់ក្នុង Production។ សូមធ្វើតាមជំហាន "សាកល្បងបង់ប្រាក់ពិត" ក្នុង deploy.md
- ⚠️ មិនបានដំឡើង/សាកល្បង `bakong-khqr`, `express`, `mongoose` ក្នុងបរិយាកាសសាងសង់ (មិនអាចចូល npm registry) → ការបង្កើត QR និង Route/DB ត្រូវតេស្តលើម៉ាស៊ីនអ្នកដំបូង
