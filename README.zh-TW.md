# Travel Planner API

[English](README.md) | 繁體中文

這是一個旅遊規劃 App 的 RESTful 後端，為 TCSS 559 Assignment 3 而開發。使用者可以建立帳號、登入、管理自己的旅行，並為旅行的每一天安排依序造訪的景點。API 會保護每個帳號的隱私：使用者只能存取自己的個人資料、旅行和行程。

## 主要功能

- **帳號：** 註冊、登入，以及查看、更新或刪除自己的帳號。
- **旅行：** 對登入使用者自己的旅行進行完整的 CRUD 操作。
- **搜尋與篩選：** 用關鍵字搜尋旅行名稱、列出即將出發或已結束的旅行，也可以同時使用。
- **每日行程：** 每趟旅行會依日期自動產生每一天。可以把景點插入任意位置、重新排序、移除單一景點，或清空一整天的行程。
- **景點：** 依城市和類別瀏覽範例景點，加入行程中。
- **資料一致性：** 多步驟的修改都在資料庫 transaction 中執行，縮短旅行時也不會刪掉已排好的景點。
- **資料隱私：** 使用 JWT 驗證身分，每個旅行查詢都限定在登入使用者的資料範圍內。
- **驗證與錯誤處理：** 統一的 JSON 錯誤回應，並搭配有意義的 HTTP 狀態碼。
- **API 文件：** OpenAPI 3 規格，並提供可互動的 Swagger UI 頁面。

## 使用技術

| 領域 | 技術 |
|---|---|
| 執行環境與框架 | Node.js、Express 5 |
| 資料庫 | PostgreSQL 17、node-postgres（`pg`） |
| 身分驗證 | JSON Web Tokens（`jsonwebtoken`）、bcrypt（`bcryptjs`） |
| API 文件 | OpenAPI 3、Swagger UI（`swagger-ui-express`） |
| 本機資料庫環境 | Docker Compose |

## 如何執行

### 事前準備

- [Node.js](https://nodejs.org/) 20 或以上版本（開發時使用 Node.js 24）
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)，執行時必須保持開啟

### 1. 啟動資料庫

在專案根目錄（`docker-compose.yml` 所在的資料夾）執行：

```bash
docker compose up -d
```

這會在 `localhost:5432` 啟動 PostgreSQL。第一次啟動時，會用 `backend/data/schema.sql` 建立資料表，並載入 `backend/data/seed.sql` 的範例資料。

### 2. 啟動後端

```bash
cd backend
npm install
```

建立環境變數檔：

```bash
# macOS、Linux 或 Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

把 `.env` 裡的 `JWT_SECRET` 換成一串夠長的隨機字串，然後啟動 server：

```bash
npm start
```

| 頁面 | 網址 |
|---|---|
| API 基礎網址 | http://localhost:3000/api |
| Swagger UI | http://localhost:3000/api-docs |

如果想在檔案變更時自動重新啟動 server，可以改用 `npm run dev`。

### 停止或重置資料庫

```bash
docker compose down      # 停止資料庫，保留資料
docker compose down -v   # 停止資料庫，並刪除資料
```

執行 `down -v` 後，下次 `docker compose up -d` 會重新建立資料表和範例資料。

## 範例帳號

所有範例帳號的密碼都是 `Password123!`。

| 姓名 | Email | 旅行數量 |
|---|---|---|
| Alice Chen | `alice@example.com` | 5 |
| Bob Tanaka | `bob@example.com` | 3 |
| Carol Lopez | `carol@example.com` | 3 |
| David Kim | `david@example.com` | 2 |
| Emma Wilson | `emma@example.com` | 2 |

Alice 的 Japan Trip（trip 1）和 Taiwan Trip（trip 3）在前幾天已經排好景點，適合用來試用行程相關的 API。

## 使用 API

1. 用 email 和密碼發送 `POST /api/auth/login`。
2. 複製回應中的 `token`。
3. 每個需要登入的請求都帶上 `Authorization: Bearer <token>`。Token 會在 1 小時後過期。

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'

curl "http://localhost:3000/api/trips?search=japan&status=upcoming" \
  -H "Authorization: Bearer <token>"
```

### 端點

| 方法 | 路徑 | 說明 | 需要 Token |
|---|---|---|---|
| POST | `/api/auth/register` | 註冊帳號 | 否 |
| POST | `/api/auth/login` | 登入並取得 token | 否 |
| GET | `/api/users/me` | 取得自己的帳號資料 | 是 |
| PUT | `/api/users/me` | 更新自己的姓名和 email | 是 |
| DELETE | `/api/users/me` | 刪除自己的帳號和旅行 | 是 |
| POST | `/api/trips` | 建立旅行 | 是 |
| GET | `/api/trips` | 列出自己的旅行，可用 `search` 和 `status` 篩選 | 是 |
| GET | `/api/trips/:tripId` | 取得自己的一筆旅行 | 是 |
| PUT | `/api/trips/:tripId` | 更新自己的一筆旅行 | 是 |
| DELETE | `/api/trips/:tripId` | 刪除自己的一筆旅行 | 是 |
| GET | `/api/trips/:tripId/itineraries` | 列出旅行的每一天，以及每天的景點數量 | 是 |
| GET | `/api/trips/:tripId/itineraries/:dayNumber` | 依造訪順序取得某一天的景點 | 是 |
| POST | `/api/trips/:tripId/itineraries/:dayNumber/items` | 把景點加到指定位置，或加到最後 | 是 |
| DELETE | `/api/trips/:tripId/itineraries/:dayNumber/items` | 清空某一天的所有景點 | 是 |
| PUT | `/api/trips/:tripId/itineraries/:dayNumber/items/order` | 重新排序某一天的景點 | 是 |
| GET | `/api/trips/:tripId/itineraries/:dayNumber/items/:itemId` | 取得單一行程項目 | 是 |
| DELETE | `/api/trips/:tripId/itineraries/:dayNumber/items/:itemId` | 從某一天移除一個景點 | 是 |
| GET | `/api/places` | 列出景點，可用 `city` 和 `category` 篩選 | 是 |

範例：把 ID 5 的景點加到第 1 天的第 2 站，再重新排列第 1 天的順序：

```bash
curl -X POST http://localhost:3000/api/trips/1/itineraries/1/items \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"placeId":5,"position":2}'

curl -X PUT http://localhost:3000/api/trips/1/itineraries/1/items/order \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"itemIds":[2,15,1]}'
```

項目 ID 可以從 `GET /api/trips/1/itineraries/1` 取得，而且 `itemIds` 必須剛好列出當天的每個項目各一次。

### 天數如何跟著旅行日期變動

- 建立旅行時，會為每個日期建立一個空的天數，從 1 開始編號。
- 修改出發日期時，每一天都會重新對應日期，景點仍留在原本的第幾天。
- 延長旅行時，會在最後補上空的天數。
- 縮短旅行時，多出來的天數只有在沒有景點時才會刪除；否則更新會回 `409`，而且不會有任何變動，所以要先清空那些天。
- 一趟旅行最長 90 天。

### 狀態碼

| 狀態碼 | 意義 |
|---|---|
| 200 / 201 / 204 | 成功、已建立，或成功但沒有回應內容 |
| 400 | 輸入無效，例如不存在的 `placeId`，或位置超出當天的範圍 |
| 401 | Token 缺少或無效，或登入資訊錯誤 |
| 404 | 找不到路由、旅行、天數或行程項目，包含屬於其他使用者的旅行 |
| 409 | Email 已被註冊，或新的旅行日期會刪掉還有景點的天數 |
| 500 | 伺服器發生非預期錯誤 |

### HTTP Headers

| Header | 用途 |
|---|---|
| `Authorization` | 在需要登入的請求中傳送 JWT |
| `Content-Type` | 標示請求和回應內容為 JSON |
| `Location` | 提供新建立資源的網址 |
| `X-Total-Count` | 自訂 header，表示列表中旅行、天數或景點的數量 |
| `WWW-Authenticate` | 受保護路由回傳 `401` 時，標示需要使用的驗證方式 |

## API 文件

文件的原始檔是 [`docs/openapi.yaml`](docs/openapi.yaml)。Server 執行時，打開 http://localhost:3000/api-docs 就能瀏覽每個端點的參數、JSON 格式、狀態碼和範例。

如果要從該頁面發送請求，先透過 `POST /auth/login` 登入，再點 **Authorize** 並貼上 token。

## 專案結構

```
.
├── docker-compose.yml        # 本機開發用的 PostgreSQL
├── docs/
│   └── openapi.yaml          # OpenAPI 規格
├── README.md                 # 英文版說明文件
├── README.zh-TW.md           # 繁體中文版說明文件
└── backend/
    ├── app.js                # Express 設定與 server 啟動
    ├── routes/               # URL 與 controller 的對應
    ├── controllers/          # 處理請求與 HTTP 回應
    ├── data/                 # 資料庫連線、SQL 查詢、schema 與種子資料
    ├── helpers/              # 驗證、身分驗證與共用錯誤類別
    └── middleware/           # 身分驗證與錯誤處理
```

請求的流向是 `route → controller → data → PostgreSQL`。每個服務模組都有獨立的 route、controller 和 query 檔案：

- **Users：** 註冊、登入，以及登入使用者自己的帳號。
- **Trips：** 旅行的 CRUD 操作、搜尋和狀態篩選。
- **Itineraries：** 旅行的每一天，以及每天依序排列的景點。
- **Places：** 可以加入行程的景點清單。

## 資料來源

`backend/data/seed.sql` 裡的資料是為這份作業模擬撰寫的，包含 5 位使用者、15 筆旅行、22 個景點、116 個行程天數（每趟旅行的每個日期各一天），以及 14 個已排好的行程項目。景點是手動輸入的知名地標，包含名稱、城市和類別。沒有使用外部資料集或真實個人資料。

## 設計說明與限制

- 這份作業涵蓋大型小組專案中的使用者、旅行和每日行程部分，不包含機票、共享旅行和費用分攤。
- 景點來自資料庫裡的範例清單，目前還沒有串接 Google Places；`googlePlaceId` 欄位是為之後串接保留的，目前是空值。
- 每筆旅行只有一位擁有者，無法共享。
- 刪除帳號時，該帳號的旅行也會一起刪除。
- 進行中的旅行在結束日過去之前都算 `upcoming`，判斷依據是資料庫伺服器的目前日期。
- 註冊後無法更改密碼。
