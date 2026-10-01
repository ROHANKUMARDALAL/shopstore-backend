# ShopStore API in Postman

Base URL: `http://127.0.0.1:43121`

Every request that has a body uses header `Content-Type: application/json`.

When the API is started with `REQUIRE_AUTH=true`, stock routes need header `Authorization: Bearer <token>` from signup or login. Signup and login stay open. Demo login after seed: `counter@shopstore.local` / `shopstore123`.

Dates are shop dates, `YYYY-MM-DD`, on the Asia/Kolkata calendar. Omit `date` and the voucher is dated today. "Today" on the dashboard uses that same calendar.

Copy an `id` from a list or create response into the next request. Product and category ids are MongoDB ids.

## Auth first

`POST http://127.0.0.1:43121/api/auth/signup`

```json
{
  "name": "Rohan Counter",
  "email": "rohan@shop.example",
  "password": "shopstore123"
}
```

Or `POST /api/auth/login` with `{ "email", "password" }`. Both return `{ "user", "token" }`. Put the token on later calls as `Authorization: Bearer <token>`.

`GET /api/auth/me` returns the current user when the token is valid.

## What each route calls

| Method and path | Function in `src/stock.js` | What it does to stock |
| --- | --- | --- |
| `GET /health` | none | Reports the process and whether MongoDB is connected. |
| `POST /api/auth/signup` | `signup` in `src/auth.js` | Creates a user. No stock change. |
| `POST /api/auth/login` | `login` in `src/auth.js` | Issues a token. No stock change. |
| `GET /api/auth/me` | `userFromToken` in `src/auth.js` | Current user. |
| `GET /api/categories` | `listCategories` | Lists categories, sorted by name. |
| `POST /api/categories` | `createCategory` | Adds a category. Does not move stock. |
| `GET /api/products` | `listProducts` | Lists products with CP, SP, qty, and margin. |
| `POST /api/products` | `createProduct` | Adds a product. `stockQty` is opening stock, not a purchase voucher. |
| `GET /api/purchases` | `listPurchases` | Lists stock-in vouchers, newest first. |
| `POST /api/purchases` | `createPurchase` | Increases stock. Sets the product's latest CP from the voucher rate. |
| `DELETE /api/purchases/:id` | `deletePurchase` | Decreases stock only if that quantity is still on hand. Does not rewind CP. |
| `GET /api/sales` | `listSales` | Lists stock-out vouchers, newest first. |
| `POST /api/sales` | `createSale` | Decreases stock. Sets the latest SP. Stores the CP at sale time for margin. Refuses the sale if qty is above stock. |
| `DELETE /api/sales/:id` | `deleteSale` | Puts the sold quantity back. Does not rewind SP. |
| `GET /api/dashboard` | `getDashboard` | Stock value at CP, stock value at SP, today's purchases, today's sales, gross margin, low stock. |

## 1. Health

`GET http://127.0.0.1:43121/health`

No body.

```json
{
  "ok": true,
  "service": "shopstore-backend",
  "db": "connected"
}
```

## 2. Categories

`GET http://127.0.0.1:43121/api/categories`

No body. A seeded database already has five categories.

`POST http://127.0.0.1:43121/api/categories`

```json
{
  "name": "Water Soluble Fertilisers"
}
```

`201` response:

```json
{
  "id": "PASTE_CATEGORY_ID",
  "name": "Water Soluble Fertilisers"
}
```

A repeated name returns `409` and `{ "error": "That category is already on the book." }`. An empty name returns `400`.

## 3. Products

`GET http://127.0.0.1:43121/api/products`

No body. Use a product `id` from this list for purchases and sales. Seeded names include `Urea 46% N (Neem Coated)` and `DAP 18:46:0`.

Each product looks like:

```json
{
  "id": "PRODUCT_ID",
  "name": "Urea 46% N (Neem Coated)",
  "categoryId": "CATEGORY_ID",
  "categoryName": "Nitrogen Fertilisers",
  "unit": "45 kg bag",
  "cp": 242,
  "sp": 266.5,
  "stockQty": 120,
  "reorderLevel": 25,
  "marginPerUnit": 24.5,
  "marginPercent": 10.12,
  "lowStock": false
}
```

`POST http://127.0.0.1:43121/api/products`

`category` is the category id from the category list.

```json
{
  "name": "NPK 19:19:19",
  "category": "PASTE_CATEGORY_ID",
  "unit": "1 kg",
  "cp": 180,
  "sp": 220,
  "stockQty": 40,
  "reorderLevel": 10
}
```

`stockQty` and `reorderLevel` are optional. They default to `0` and `10`. `201` returns the same product shape as the list.

## 4. Stock in (purchase)

`POST http://127.0.0.1:43121/api/purchases`

```json
{
  "supplierName": "Krishak Co-op Depot",
  "date": "2026-10-01",
  "lines": [
    {
      "product": "PASTE_PRODUCT_ID",
      "qty": 20,
      "cp": 250
    }
  ]
}
```

Stock of that product increases by 20. The product CP becomes `250`. The line keeps the rate you sent, even if a later line on the same voucher sets a newer CP.

`201` response:

```json
{
  "id": "PURCHASE_ID",
  "supplierName": "Krishak Co-op Depot",
  "date": "2026-09-30T18:30:00.000Z",
  "lines": [
    {
      "productId": "PRODUCT_ID",
      "productName": "Urea 46% N (Neem Coated)",
      "unit": "45 kg bag",
      "qty": 20,
      "cp": 250,
      "lineTotal": 5000
    }
  ],
  "total": 5000
}
```

The stored date is the start of that shop day in IST, so it shows as the previous evening in UTC.

`GET http://127.0.0.1:43121/api/purchases` returns an array of those vouchers.

`DELETE http://127.0.0.1:43121/api/purchases/PURCHASE_ID`

No body. Success:

```json
{ "ok": true }
```

Stock goes down by the voucher quantity. If those bags were already sold, the API returns `409` and the voucher stays. Example:

```json
{
  "error": "This purchase cannot be deleted. Urea 46% N (Neem Coated) has 8 45 kg bag left, but the voucher put 20 45 kg bag in. Those bags have already moved."
}
```

## 5. Stock out (sale)

`POST http://127.0.0.1:43121/api/sales`

```json
{
  "customerShopName": "Sharma Krishi Bhandar",
  "date": "2026-10-01",
  "lines": [
    {
      "product": "PASTE_PRODUCT_ID",
      "qty": 8,
      "sp": 270
    }
  ]
}
```

Stock decreases by 8. The product SP becomes `270`. Margin on the line is quantity times (SP minus the cost price on the product at the moment of the sale).

`201` response:

```json
{
  "id": "SALE_ID",
  "customerShopName": "Sharma Krishi Bhandar",
  "date": "2026-09-30T18:30:00.000Z",
  "lines": [
    {
      "productId": "PRODUCT_ID",
      "productName": "Urea 46% N (Neem Coated)",
      "unit": "45 kg bag",
      "qty": 8,
      "sp": 270,
      "cpAtSale": 250,
      "lineTotal": 2160,
      "margin": 160
    }
  ],
  "total": 2160,
  "margin": 160
}
```

If the lines ask for more than the quantity on hand, nothing is saved and stock does not change. `409`:

```json
{
  "error": "Only 12 45 kg bag of Urea 46% N (Neem Coated) are in stock. This sale asks for 20."
}
```

Two lines for the same product are added together before that check.

`GET http://127.0.0.1:43121/api/sales` returns the array.

`DELETE http://127.0.0.1:43121/api/sales/SALE_ID`

No body. `{ "ok": true }`. The quantity returns to stock. The selling price stays at the rate that was posted.

## 6. Dashboard

`GET http://127.0.0.1:43121/api/dashboard`

No body.

```json
{
  "stockValueAtCp": 510375,
  "stockValueAtSp": 564185,
  "todayPurchaseTotal": 5000,
  "todaySalesTotal": 2160,
  "grossMargin": 160,
  "lowStock": []
}
```

- `stockValueAtCp` is quantity times current CP, summed across products.
- `stockValueAtSp` is quantity times current SP.
- `todayPurchaseTotal` and `todaySalesTotal` count only vouchers dated today in IST.
- `grossMargin` is today's sales minus `cpAtSale` on those sale lines.
- `lowStock` is products whose `stockQty` is at or under `reorderLevel`. Each item has the same shape as a product in the product list.

## Suggested Postman order

1. `GET /health`
2. `GET /api/categories` and copy a category id, or `POST /api/categories`
3. `GET /api/products` and copy a product id, or `POST /api/products`
4. `POST /api/purchases` with that product id
5. `GET /api/products` and check `stockQty` and `cp`
6. `POST /api/sales` with a qty above stock, and expect `409`
7. `POST /api/sales` with a qty that is on hand
8. `GET /api/dashboard`
9. `DELETE /api/sales/:id` and check the quantity came back
10. `DELETE /api/purchases/:id` after the stock is still there, then try it again after selling those bags and expect `409`
