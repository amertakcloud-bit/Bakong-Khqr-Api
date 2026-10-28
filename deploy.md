# មគ្គុទេសក៍ Deploy — KHQR Payment (ពីដើមដល់ចប់)

> សូមអានផ្នែកទី ១៤ ជាមុន ដើម្បីដឹងថាអ្វីបានសាកល្បងពិត និងអ្វីមិនទាន់។

---

## 1. តម្រូវការកម្មវិធី

| កម្មវិធី | ចំណាំ |
|---|---|
| **Node.js 18 ឬថ្មីជាង** (ណែនាំ 20/22 LTS) | ទាញពី https://nodejs.org · ពិនិត្យ៖ `node -v` |
| **VS Code** | https://code.visualstudio.com |
| **Git** | https://git-scm.com · ត្រូវការសម្រាប់ Deploy |
| **MongoDB** | ជម្រើស A៖ MongoDB Atlas (Cloud, ឥតគិតថ្លៃ) · ជម្រើស B៖ MongoDB Community លើម៉ាស៊ីន |
| គណនី **GitHub**, **Render**, **Vercel** | សម្រាប់ Deploy |
| គណនី **Bakong** (តាមធនាគាររបស់អ្នក) | ត្រូវការ Bakong Account ID (ទម្រង់ `name@bank`) សម្រាប់ទទួលប្រាក់ |

## 2. បើក Project ក្នុង VS Code

1. ចម្លងថត `khqr-payment/` ទៅកន្លែងដែលអ្នកចង់បាន
2. VS Code → **File → Open Folder…** → ជ្រើស `khqr-payment`
3. បើក Terminal៖ **Terminal → New Terminal** (ឬ ``Ctrl + ` ``)

## 3. ដំឡើង Dependencies

```bash
npm install
```

វាដំឡើង `express`, `mongoose`, `bakong-khqr`, `qrcode`, `helmet`, `cors`, `express-rate-limit`, `dotenv`។

> ⚠️ ការដំឡើងនេះ **មិនទាន់បានធ្វើក្នុងពេលសាងសង់** (មិនអាចចូល npm registry)។ ប្រសិនបើ `bakong-khqr` ដំឡើងមិនបាន ឬ Version ខុសពី `^1.0.0` សូមមើល https://www.npmjs.com/package/bakong-khqr ហើយកែ `package.json`។

## 4. MongoDB

### ជម្រើស A — MongoDB Atlas (ណែនាំ ព្រោះប្រើបានទាំង Local, Render, Vercel)

1. ចុះឈ្មោះ https://www.mongodb.com/cloud/atlas
2. **Create** Cluster ឥតគិតថ្លៃ (M0)
3. **Database Access → Add New Database User** → កំណត់ Username + Password (សរសេរទុក)
4. **Network Access → Add IP Address**
   - Render/Vercel មាន IP មិនថេរ → ជ្រើស **Allow access from anywhere (`0.0.0.0/0`)** ហើយពឹងលើ Password ខ្លាំង
5. **Database → Connect → Drivers** → ចម្លង Connection String ឧ.
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/khqr?retryWrites=true&w=majority`
   - ជំនួស `<password>` ដោយពាក្យសម្ងាត់ពិត (បើមានតួអក្សរពិសេស ត្រូវ URL-encode)
   - ដាក់ឈ្មោះ Database (`/khqr`) មុនសញ្ញា `?`

### ជម្រើស B — MongoDB លើម៉ាស៊ីន (Local)

- ដំឡើង MongoDB Community Server ពី https://www.mongodb.com/try/download/community
- Windows៖ ដំណើរការជា Service ដោយស្វ័យប្រវត្តិ · macOS (Homebrew)៖ `brew services start mongodb-community` · Linux៖ `sudo systemctl start mongod`
- `MONGODB_URI=mongodb://127.0.0.1:27017/khqr`
- Local MongoDB **ប្រើលើ Render/Vercel មិនបាន**

## 5. បង្កើតឯកសារ `.env`

```bash
cp .env.example .env          # Windows PowerShell៖ copy .env.example .env
```

បើក `.env` ហើយបំពេញ។ ខាងក្រោមជាកន្លែងយកតម្លៃនីមួយៗ (**គ្មានតម្លៃណាមួយមានរួចជាស្រេចទេ**)៖

| Variable | យកពីណា |
|---|---|
| `MONGODB_URI` | ផ្នែកទី ៤ |
| `BAKONG_API_TOKEN` | ផ្នែកទី ៦ |
| `BAKONG_ACCOUNT_ID` | គណនី Bakong របស់អ្នកទទួលប្រាក់ ទម្រង់ `name@bank`។ មើលក្នុងកម្មវិធីធនាគាររបស់អ្នក (ទំព័រ KHQR / Bakong ID ផ្ទាល់ខ្លួន) |
| `MERCHANT_NAME` | ឈ្មោះដែលអ្នកបង់ប្រាក់ឃើញ (≤ 25 តួអក្សរ) អ្នកជាអ្នកកំណត់ |
| `MERCHANT_CITY` | ទីក្រុង (≤ 15 តួអក្សរ) |
| `CLIENT_URL` | URL ដែលអ្នកប្រើបើកគេហទំព័រ (ផ្នែកទី ១១) |
| `IP_HASH_SALT` | អក្សរចៃដន្យណាមួយដែលអ្នកបង្កើត (Render អាចបង្កើតឱ្យ) |

> **កុំ** Commit `.env` ទៅ Git (`.gitignore` បានការពារហើយ)។

## 6. ទទួល Bakong API Token ពិត

1. ទៅ https://api-bakong.nbc.gov.kh/register (ឬតាមទំព័រ Bakong Open API ផ្លូវការ) ហើយចុះឈ្មោះដោយអ៊ីមែល
2. ធ្វើតាមជំហានបញ្ជាក់ (Verify) ដែលទំព័រនោះបង្ហាញ → នឹងទទួលបាន **Token** (JWT វែង ចាប់ផ្តើម `eyJ...`)
3. ដាក់ក្នុង `.env` ជា `BAKONG_API_TOKEN=...`
4. Token **មានអាយុកាល** → បើផុតកំណត់ Bakong នឹងបដិសេធ (401/Invalid Token) ត្រូវ Renew ដោយ `POST /v1/renew_token` ជាមួយអ៊ីមែលដែលបានចុះឈ្មោះ ឬចុះឈ្មោះម្ដងទៀត

> ជំហានចុះឈ្មោះ លក្ខខណ្ឌ និងរយៈពេល Token ត្រូវផ្ទៀងផ្ទាត់នៅទំព័រផ្លូវការ https://api-bakong.nbc.gov.kh/document — ខ្ញុំមិនអាចអានទំព័រនោះដោយផ្ទាល់ (វា render ដោយ JavaScript) ទេ ព័ត៌មានខាងលើមកពីឯកសារ/Client របស់សហគមន៍។ ខ្ញុំមិនមាន Token ណាមួយរបស់អ្នកទេ។

## 7. រកមើល Environment Variables ក្នុង Dashboard

**Render**៖ Dashboard → ជ្រើស Service → ម៉ឺនុយឆ្វេង **Environment** → **Add Environment Variable** → Save (Render នឹង Redeploy)

**Vercel**៖ Dashboard → ជ្រើស Project → **Settings → Environment Variables** → បញ្ចូល Key/Value → ជ្រើស Environment (Production/Preview) → Save → **Redeploy** (តម្លៃថ្មីមានប្រសិទ្ធភាពតែក្រោយ Deploy ថ្មី)

## 8. Run លើ Localhost

```bash
npm start
```

បើកក្នុង Browser៖ http://localhost:5000

លទ្ធផល Log ត្រូវមាន៖ `[db] connected` និង `[server] listening on port 5000`។ បើមាន `Missing environment variables: ...` សូមបំពេញ `.env`។ ប្រើ `npm run dev` ដើម្បី Restart ស្វ័យប្រវត្តិពេលកែកូដ។

## 9. សាកល្បង Health Check, បង្កើត QR, ពិនិត្យ Transaction

**Health**៖
```bash
curl http://localhost:5000/api/health
```
ត្រូវបាន `"ok": true`, `"database": "connected"`, `"config": {"complete": true, "missing": []}`។

**បង្កើត QR** (តាមទំព័រគេហទំព័រ ឬ curl)៖
```bash
curl -X POST http://localhost:5000/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{"amount":"100","currency":"KHR"}'
```
ទទួលបាន `orderId`, `qr`, `qrImage`។ ស្កេនដោយកម្មវិធីធនាគារ ត្រូវបង្ហាញឈ្មោះ `MERCHANT_NAME` និងចំនួនទឹកប្រាក់ត្រឹមត្រូវ។

**សាកល្បងបង់ប្រាក់ពិត (ជំហានតែមួយគត់ដែលបញ្ជាក់ថា Auto Check ដំណើរការ)**៖
1. បង្កើត Order ចំនួនតូច (ឧ. `100` KHR)
2. បង់ពិតតាមកម្មវិធីធនាគារ (ពីគណនីផ្សេងពីគណនីទទួល)
3. ទំព័រត្រូវប្តូរទៅ **PAID** ក្នុងរយៈពេល ~៤–១០ វិនាទី
4. ពិនិត្យ Log៖ `[payment] order ORD-... PAID`
5. ពិនិត្យដោយដៃ៖ `curl -X POST http://localhost:5000/api/payment/check/ORD-XXXXXXXXXX` · `curl http://localhost:5000/api/payment/status/ORD-XXXXXXXXXX`

បើមិនប្តូរ សូមមើលផ្នែកទី ១២។

## 10. Deploy

ដាក់កូដលើ GitHub មុន (ថតគម្រោងជា Root នៃ Repo)៖
```bash
git init && git add . && git commit -m "khqr payment"
git branch -M main
git remote add origin https://github.com/<you>/khqr-payment.git
git push -u origin main
```
ពិនិត្យថា `.env` មិនស្ថិតក្នុង Repo។

### 10.1 Render (ណែនាំសម្រាប់ Auto Check ពេញលេញ)

1. Render → **New → Blueprint** → ភ្ជាប់ Repo (វាអាន `render.yaml`) · ឬ **New → Web Service** ហើយកំណត់ដោយដៃ៖
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
2. បំពេញ Variables ដែលសម្គាល់ `sync: false` ក្នុង **Environment** (ផ្នែកទី ៧)
3. Deploy → បើក URL `https://<name>.onrender.com`
4. Frontend និង Backend នៅ Server តែមួយ (Render បម្រើ `public/`) ដូច្នេះមិនត្រូវការ Deploy Frontend ដាច់ដោយឡែក
5. `BACKGROUND_POLLING=true` ធ្វើឱ្យ Server ពិនិត្យ Bakong តាមចន្លោះពេល ទោះអ្នកបង់បិទ Browser ក៏ដោយ

**ដែនកំណត់ Render Free**៖ Service ដេកក្រោយ ~១៥ នាទីគ្មានចរាចរណ៍ → Background polling ឈប់រហូតដល់មាន Request ថ្មី ហើយ Request ដំបូងយឺត (Cold start)។ ការទូទាត់ដែលកើតពេលដេក នឹងត្រូវបានរកឃើញពេល Service ភ្ញាក់ និង Order ក្នុងរយៈពេល ៥ នាទីក្រោយផុតកំណត់ (បើលើសពីនោះ Order ត្រូវបានបិទជា `EXPIRED`)។ សម្រាប់ប្រើពិតប្រាកដ ណែនាំ Plan បង់ប្រាក់។

### 10.2 Vercel

1. Vercel → **Add New → Project** → Import Repo
2. **Framework Preset**: Other · Build/Output ទុកលំនាំដើម (`public/` ត្រូវបានបម្រើជា Static ស្វ័យប្រវត្តិ, `api/index.js` ជា Function តាម `vercel.json`)
3. បញ្ចូល Environment Variables (ផ្នែកទី ៧) **ទុក `BACKGROUND_POLLING` ទទេ**
4. Deploy

**ភាពខុសគ្នាសំខាន់ (Vercel មិនមែនស្មើ Render ទេ)**៖
- ❌ គ្មាន Background polling / Process រត់ជាប់ → ការពិនិត្យកើតតែពេល Browser របស់អ្នកបង់ **ហៅ `/api/payment/check`** (ទំព័រធ្វើដោយស្វ័យប្រវត្តិ)។ បើអ្នកបង់បិទ Browser មុន Order ត្រូវបានផ្ទៀងផ្ទាត់ ការទូទាត់នឹងមិនត្រូវបានកត់ត្រាទេ (រហូតដល់មាននរណាម្នាក់ហៅ check)
- ជម្រើសជំនួសប្រសិនបើត្រូវការ៖ ប្រើ Render សម្រាប់ Backend (Background polling) + Vercel សម្រាប់ Static Frontend ឬបន្ថែម Cron ខាងក្រៅដែលហៅ `/api/payment/check/:orderId`
- Function មាន Time limit (`maxDuration` ក្នុង `vercel.json` កំណត់ ៣០វិ · ព្រំដែនពិតអាស្រ័យ Plan របស់អ្នក ត្រូវពិនិត្យ) · `BAKONG_TIMEOUT_MS` ត្រូវតូចជាងនេះ (លំនាំដើម ៨វិ)
- Rate limit ក្នុង Memory ក្នុងមួយ Instance (មិនចែករំលែក) → ខ្សោយជាង Render។ ការកំណត់ Order Pending ក្នុងមួយ IP ប្រើ DB ដូច្នេះនៅតែដំណើរការ
- MongoDB Atlas ត្រូវតែអនុញ្ញាត IP ទាំងអស់ (`0.0.0.0/0`)

### 10.3 ដាក់ Frontend ដាច់ដោយឡែក (ជម្រើស)

លំនាំដើម Frontend ស្ថិតក្នុង Backend (Same-origin, មិនត្រូវការ CORS)។ បើអ្នកចង់ដាក់ `public/` ទៅ GitHub Pages ត្រូវ៖ កែ `const API = '...'` ក្នុង `public/app.js` ទៅ URL Backend ពេញ ហើយដាក់ Origin ក្នុង `CLIENT_URL` និងកែ `connect-src` ក្នុង CSP (`src/app.js`)។

## 11. កំណត់ `CLIENT_URL`, CORS, MongoDB Connection

- `CLIENT_URL` = Origin ដែល Browser ប្រើបើកគេហទំព័រ (គ្មាន `/` ចុង)៖
  - Local៖ `http://localhost:5000`
  - Render៖ `https://<name>.onrender.com`
  - Vercel៖ `https://<project>.vercel.app` (ឬដែនផ្ទាល់ខ្លួន)
  - ច្រើន Origin៖ ញែកដោយក្បៀស `https://a.com,https://b.com`
- CORS ត្រូវការតែពេល Frontend នៅ Origin ផ្សេងពី Backend។ Same-origin មិនប៉ះពាល់។
- Render/Vercel ផ្តល់ HTTPS ស្វ័យប្រវត្តិ
- Atlas៖ Network Access ត្រូវអនុញ្ញាត IP (`0.0.0.0/0`), User/Password ត្រឹមត្រូវ, URI មានឈ្មោះ Database

## 12. ដោះស្រាយបញ្ហា

| អាការ | មូលហេតុ / ដំណោះស្រាយ |
|---|---|
| **401** ពី Bakong (`BAKONG_AUTH` ក្នុង Log) | Token មិនត្រឹមត្រូវ ឬផុតកំណត់ → ទទួល/Renew Token (ផ្នែកទី ៦) រួចកែ Environment Variable ហើយ Redeploy |
| **403** ពី Bakong (`BAKONG_FORBIDDEN`) | Token គ្មានសិទ្ធិ API នោះ **ឬ** Bakong ទប់ស្កាត់ IP របស់ Server។ មានរបាយការណ៍ពីអ្នកអភិវឌ្ឍន៍ថា Bakong អាចបដិសេធ IP ពីក្រៅប្រទេស (Render/Vercel ភាគច្រើននៅក្រៅកម្ពុជា) — **ខ្ញុំមិនបានផ្ទៀងផ្ទាត់ទេ**។ សាកល្បងពី Localhost (IP កម្ពុជា) ប្រៀបធៀប ហើយសួរ NBC/ធនាគារអំពីលក្ខខណ្ឌ។ ជម្រើស៖ Relay/Proxy នៅកម្ពុជា |
| **404** | URL ខុស (ពិនិត្យ `/api/...`) ឬ `ORDER_NOT_FOUND` (Order ID ខុស) · ពី Bakong៖ `BAKONG_BASE_URL` ខុស |
| **429** | `RATE_LIMITED` (Server យើង) ឬ `BAKONG_RATE_LIMIT` → បង្កើន `CHECK_MIN_INTERVAL_SECONDS`, កុំបើកច្រើន Tab · Frontend ថយ Polling ស្វ័យប្រវត្តិ |
| **Timeout** (`BAKONG_TIMEOUT`) | Bakong យឺត ឬបណ្ដាញខ្សោយ → បង្កើន `BAKONG_TIMEOUT_MS` (≤ Function limit) · Order នៅ PENDING ហើយព្យាយាមម្ដងទៀត |
| **Invalid Token** | Token ចម្លងមិនពេញ/មានដកឃ្លា/ផុតកំណត់ → ចម្លងឡើងវិញ |
| **Database error** (`DB_UNAVAILABLE`) | URI ខុស, Password មានតួអក្សរពិសេស (URL-encode), Atlas IP Whitelist, Cluster ដេក → ពិនិត្យ `GET /api/health` |
| `SERVICE_NOT_CONFIGURED` | ខ្វះ Variable → មើល `/api/health` → `config.missing` |
| `KHQR_GENERATION_FAILED` | `BAKONG_ACCOUNT_ID` ទម្រង់ខុស, `MERCHANT_NAME` > 25 តួ, `MERCHANT_CITY` > 15 តួ → មើល Log |
| `KHQR_SDK_MISSING` | `npm install` មិនបានដំឡើង `bakong-khqr` |
| បង់ហើយតែនៅ PENDING | (១) Log មាន `[bakong] check failed` ឬទេ? (២) Token/IP (៣) បង់ពីគណនីនេះ ទៅគណនីផ្សេង? (៤) បង់ក្រោយ QR ផុតកំណត់ |
| Order ទៅ **FAILED** | Bakong រកឃើញ Transaction តែមិនត្រូវ Order → មើល `failureReason` ក្នុង MongoDB (`amount_mismatch`, `receiver_mismatch`, `currency_mismatch`, `receiver_missing`, `transaction_before_order`, `duplicate_transaction`) · `receiver_missing` មានន័យថា Response របស់ Bakong គ្មាន `toAccountId` → អាចកំណត់ `REQUIRE_RECEIVER_MATCH=false` បានតែបើអ្នកយល់ហានិភ័យ |

## 13. ពិនិត្យ Log និងសុវត្ថិភាព

**Log**៖ Render → Service → **Logs** · Vercel → Project → **Logs** (ឬ Deployments → Functions) · Local → Terminal។ Log មិនមាន Token ទេ។

**សុវត្ថិភាព Checklist**៖
- [ ] `.env` មិនស្ថិតក្នុង Git · បើធ្លាប់ Commit Token ត្រូវ **Renew Token** ភ្លាម
- [ ] Token មានតែក្នុង Environment Variables នៃ Server (មិនដែលក្នុង `public/`)
- [ ] MongoDB User ប្រើ Password ខ្លាំង · សិទ្ធិតែ Database នេះ
- [ ] PAID ត្រូវបានកំណត់តែ Server តាម Bakong (Frontend/រូបបង្កាន់ដៃមិនអាច)
- [ ] ដាក់ការផ្ដល់ផលិតផលក្នុង `src/services/fulfillment.js` តែប៉ុណ្ណោះ
- [ ] ព្រមាន៖ Order ID ជា Secret ទន់ (50-bit ចៃដន្យ) ប្រើសម្រាប់មើលស្ថានភាព · កុំដាក់ព័ត៌មានផ្ទាល់ខ្លួនក្នុង Response
- [ ] ពិនិត្យ `GET /api/health` ទៀងទាត់ (Render Health Check ប្រើរួចហើយ)

## 14. អ្វីដែលបានសាកល្បង និងអ្វីដែលមិនទាន់

**បានសាកល្បងជាក់ស្ដែង (Mock, 20 tests ✅ — `npm test`)**
- ការ Validate ចំនួនទឹកប្រាក់/រូបិយប័ណ្ណ/Order ID
- ក្បួនផ្ទៀងផ្ទាត់ទូទាត់ (ចំនួន, រូបិយប័ណ្ណ, គណនីទទួល, ពេលវេលា) ជាមួយទិន្នន័យ **Mock**
- Bakong client ជាមួយ `fetch` **Mock**៖ Header/URL/Body, Found, Not found, 401, 403, 429, 5xx, Timeout, Network error, Response ខូច
- `node --check` Syntax គ្រប់ឯកសារ

**មិនទាន់បានសាកល្បង (ត្រូវការមុខងារ/សិទ្ធិពិតរបស់អ្នក)**
- ❌ **Bakong API ពិត + Token ពិត** → Auto Transaction Check មិនទាន់បានបញ្ជាក់ក្នុងប្រតិបត្តិការពិត។ ការបកស្រាយ Response (`responseCode`, `errorCode`, `data.hash/amount/currency/toAccountId`) ផ្អែកលើឯកសារ/Client សហគមន៍ មិនមែនពីការហៅពិត។ ការបែងចែក "មិនទាន់រក​ឃើញ" ធៀបនឹង "កំហុស" ដោយ `errorCode` (2 និង 5 ជាកំហុស) ត្រូវផ្ទៀងផ្ទាត់
- ❌ **SDK `bakong-khqr`**៖ មិនបានដំឡើង (npm registry មិនអាចចូលពីបរិយាកាសសាងសង់) → `src/services/khqr.js` សរសេរតាម API ដែលខ្ញុំស្គាល់ (`IndividualInfo`, `BakongKHQR.generateIndividual`, `khqrData.currency`) **មិនទាន់បានរត់**។ បើវាមិនដំណើរការ សូមផ្ទៀងផ្ទាត់ជាមួយ README របស់ package
- ❌ Express/Mongoose/Routes, Atomic update, Unique index, Background poller, Rate limit → មិនបានរត់ (ព្រោះគ្មាន dependencies/DB)
- ❌ Frontend UI មិនបានមើលក្នុង Browser
- ❌ ការ Deploy លើ Render/Vercel
- ❌ ការស្កេន QR ដោយកម្មវិធីធនាគារពិត (ត្រូវផ្ទៀងផ្ទាត់ថា Dynamic KHQR ប្រភេទ Individual ត្រូវបានទទួលស្គាល់ និងអាចផ្ទៀងផ្ទាត់តាម MD5)
- ℹ️ គម្រោងនេះប្រើ **Dynamic QR (មានចំនួនទឹកប្រាក់) តែប៉ុណ្ណោះ**។ Static QR មិនត្រូវបានគាំទ្រទេ (ឯកសារ/Client សហគមន៍ថា MD5 check មិនគាំទ្រ Static)

ប្រសិនបើជំហាន "សាកល្បងបង់ប្រាក់ពិត" (ផ្នែកទី ៩) ជោគជ័យលើ Localhost និងលើ Platform ដែលអ្នក Deploy ទើបអាចអះអាងថា Auto Check ដំណើរការពិត។
