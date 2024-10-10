const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema({
  workerID: { type: String, required: true }, // Ensure this field is included and required
  name: { type: String, required: true },
  total_stock_count: { type: Number, default: 0 },
  blocks: [
    {
      block_name: { type: String },
      rows: [
        {
          row_number: { type: String },
          stock_count: { type: Number },
          time_spent: { type: Number },
          date: { type: Date }, // New field to track the date
          day_of_week: { type: String }, // New field to track the day of the week
        },
      ],
      daily_stock_entries: [
        {
          date: String, // Store date in "YYYY-MM-DD" format
          row_number: String, // The row worked on
          block_name: String, // The block associated with the row
          stock_count: Number, // Number of stocks worked on that day
          time_spent: Number, // Time spent on this task in minutes
        },
      ],
    },
  ],
});

const Worker = mongoose.model("Worker", workerSchema);

module.exports = Worker;
