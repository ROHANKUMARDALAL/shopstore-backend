# ShopStore API

Stock book for a fertiliser wholesale and retail counter. It covers categories, products with unique HSN codes and per-product GST (CGST+SGST split), purchases, sales, and optional e-way bill fields. Counter staff sign up or log in. There is no full accounts ledger.

Counter staff post vouchers. A purchase (stock in) increases quantity and stores that voucher rate as the product's latest cost price. A sale (stock out) decreases quantity and stores that voucher rate as the latest selling price. A sale cannot take more than the quantity on hand. Deleting a sale puts the quantity back. Deleting a purchase takes the quantity back only when it is still on hand.

Shop dates and the dashboard's "today" use the Asia/Kolkata calendar.

## Run locally

You need Node.js 20 or newer and a MongoDB database.

```bash
cp .env.example .env
npm install
npm run dev
```

Set `MONGODB_URI` in `.env`. The process listens on `0.0.0.0:43121` unless `PORT` is set. It will not start when `MONGODB_URI` is missing.

On an empty database the server inserts the opening book itself. To seed without leaving the server up:

```bash
npm run seed
```

`CORS_ORIGIN` is the browser origin allowed to call the API. For the ShopStore counter use `http://127.0.0.1:43123`. Separate several origins with commas.

Set `JWT_SECRET` before production. With `REQUIRE_AUTH=true`, every stock route needs header `Authorization: Bearer <token>` from signup or login. Signup and login stay open. Local tests leave `REQUIRE_AUTH` unset so the stock checks stay open.

An empty database also gets a demo counter login: `counter@shopstore.local` / `shopstore123`.

### Routes

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Process is up. Reports whether MongoDB is connected. |
| POST | `/api/auth/signup` | Create a counter user. Returns `{ user, token }`. |
| POST | `/api/auth/login` | Sign in. Returns `{ user, token }`. |
| POST | `/api/auth/forgot-userid` | Look up email / user ID by counter name. |
| POST | `/api/auth/forgot-password` | Issue a 6-digit reset code (returned for local shop use). |
| POST | `/api/auth/reset-password` | Set a new password with email + reset code. |
| GET | `/api/auth/me` | Current user from the Bearer token. |
| GET, POST | `/api/categories` | List or add a category. |
| GET, POST | `/api/products` | List or add a product (HSN, GST %, category, unit, CP, SP, opening qty). |
| GET, POST | `/api/purchases` | List or post a stock-in voucher (optional e-way bill / vehicle / transporter). |
| DELETE | `/api/purchases/:id` | Reverse a purchase when stock still covers it. |
| GET, POST | `/api/sales` | List or post a stock-out voucher (optional e-way bill / vehicle / transporter). |
| DELETE | `/api/sales/:id` | Reverse a sale and restore stock. |
| GET | `/api/dashboard` | Stock value at CP, stock value at SP, today's purchases, today's sales, gross margin, low stock. |

Gross margin is today's sales minus the cost price that was on each product when it was sold.

Opening quantities on seeded products are the godown count at go-live. They are not purchase vouchers, so the purchase register starts empty.

## Tests

```bash
npm test
```

Tests start MongoDB in memory with `mongodb-memory-server`. A separate `mongod` is not required.

## Render

`render.yaml` is a Node web service. Build command `npm install`, start command `npm start`, health check `/health`.

1. In Render, create the service from this blueprint or point a web service at the repo with those commands.
2. Set `MONGODB_URI` to a MongoDB database Render can reach.
3. Set `CORS_ORIGIN` to the frontend origin, for example the deployed counter URL.
4. Render provides `PORT`. The app binds `0.0.0.0` and uses that port.

The first boot of an empty database loads the same opening book as `npm run seed`.

## Opening book

1. Nitrogen Fertilisers
2. Phosphatic Fertilisers
3. Potassic Fertilisers
4. NPK Complex Fertilisers
5. Crop Protection

Each category has three products with plausible INR counter rates (bags, litres, or packs). These are shop rates for the stock book, not a government price list.

The coloured counter workflow is in `docs/shopstore-workflow.pdf`.

Request bodies, sample responses, and the function behind each route are in `docs/postman.md`.
