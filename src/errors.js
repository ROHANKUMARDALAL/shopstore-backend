export class StockError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "StockError";
    this.status = status;
  }
}
