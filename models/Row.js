const mongoose = require("mongoose");

const rowSchema = new mongoose.Schema({
  row_number: { type: String, required: true },
  worker_name: { type: String, default: "" },
  worker_id: { type: String, default: "" },
  time_spent: { type: Number, default: 0 }, // time in minutes
  stock_count: { type: Number, default: 0 },
  start_time: { type: Date, default: null },
});

const Row = mongoose.model("Row", rowSchema);

module.exports = Row;
