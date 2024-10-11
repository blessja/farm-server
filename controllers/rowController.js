const Worker = require("../models/Worker");
const Block = require("../models/Block");

// Check-in a worker
exports.checkInWorker = async (req, res) => {
  const { workerID, workerName, rowNumber, blockName } = req.body;

  try {
    // Find the block with the given block name
    const block = await Block.findOne({ block_name: blockName });
    if (!block) {
      return res.status(404).json({ message: "Block not found" });
    }

    // Find the specific row in the block
    const row = block.rows.find((row) => row.row_number === rowNumber);
    if (!row) {
      return res.status(404).json({ message: "Row not found" });
    }

    // Check if the row is already assigned to a worker
    if (row.worker_name) {
      return res.status(400).json({
        message: `Row ${rowNumber} is already being worked on by ${row.worker_name}. The row must be checked out before another worker can check in.`,
      });
    }

    // Initialize remaining stock count based on the previous session
    let remainingStocks = row.remaining_stock_count || row.stock_count;

    // Assign the worker and set the start time
    row.worker_name = workerName;
    row.worker_id = workerID;
    row.start_time = new Date(); // Use current UTC time

    await block.save();

    // Optionally, save the worker to the Worker collection if not already existing
    const workerExists = await Worker.findOne({ workerID: workerID });
    if (!workerExists) {
      const newWorker = new Worker({
        workerID: workerID,
        name: workerName,
        blocks: [],
      });
      await newWorker.save();
    }

    // Send a response after the block is saved
    return res.json({
      message: "Check-in successful",
      rowNumber: row.row_number,
      remainingStocks,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Check-out a worker
exports.checkOutWorker = async (req, res) => {
  const { workerID, workerName, rowNumber, blockName, stockCount } = req.body;

  try {
    // Find the block with the given block name
    const block = await Block.findOne({ block_name: blockName });
    if (!block) {
      return res.status(404).send({ message: "Block not found" });
    }

    // Find the specific row in the block
    const row = block.rows.find(
      (row) => row.row_number === rowNumber && row.worker_name === workerName
    );
    if (!row) {
      return res.status(404).send({ message: "Row or worker not found" });
    }

    const endTime = new Date();
    const timeSpentInMinutes = (endTime - row.start_time) / 1000 / 60; // time in minutes

    // If no stockCount is provided, assume the worker has worked all remaining stocks
    let calculatedStockCount;
    if (typeof stockCount !== "number" || isNaN(stockCount)) {
      // Set stock count to all remaining stocks
      calculatedStockCount = row.remaining_stock_count || row.stock_count;
    } else {
      calculatedStockCount = stockCount;
    }

    // Update remaining stocks based on the current checkout
    const remainingStocks = row.remaining_stock_count
      ? row.remaining_stock_count - calculatedStockCount
      : row.stock_count - calculatedStockCount;

    if (remainingStocks < 0) {
      return res
        .status(400)
        .send({ message: "Stock count cannot be negative" });
    }

    // Initialize daily_stock_entries array if it doesn't exist
    if (!row.daily_stock_entries) {
      row.daily_stock_entries = [];
    }

    // Log daily stock entry (for history purposes)
    row.daily_stock_entries.push({
      stock_count: calculatedStockCount,
      time_spent: timeSpentInMinutes,
      date: endTime, // Save the date
    });

    // Update the remaining stock count in the row
    row.remaining_stock_count = remainingStocks;

    // Clear worker from the row in the Block collection
    row.worker_name = "";
    row.worker_id = "";
    row.start_time = null;
    row.time_spent = null;

    await block.save();

    // Fetch or create worker record
    let worker = await Worker.findOne({ workerID });
    if (!worker) {
      worker = new Worker({
        workerID: workerID,
        name: workerName,
        total_stock_count: 0,
        blocks: [],
      });
    }

    // Update worker's total stock count
    worker.total_stock_count += calculatedStockCount;

    // Check if the worker has the block
    let workerBlock = worker.blocks.find((b) => b.block_name === blockName);
    if (!workerBlock) {
      workerBlock = {
        block_name: blockName,
        rows: [],
        daily_stock_entries: [],
      };
      worker.blocks.push(workerBlock);
    }

    // Find the row in the worker's block
    let workerRow = workerBlock.rows.find((r) => r.row_number === rowNumber);
    if (!workerRow) {
      workerRow = {
        row_number: rowNumber,
        stock_count: 0,
        time_spent: 0,
        date: new Date(),
        day_of_week: new Date().toLocaleDateString("en-US", {
          weekday: "long",
        }),
      };
      workerBlock.rows.push(workerRow);
    }

    // Update stock count for the worker's row
    workerRow.stock_count += calculatedStockCount;
    workerRow.time_spent += timeSpentInMinutes;

    // Update daily stock entries for the worker
    workerBlock.daily_stock_entries.push({
      date: new Date().toISOString().split("T")[0], // Store date in "YYYY-MM-DD" format
      row_number: rowNumber,
      block_name: blockName,
      stock_count: calculatedStockCount,
      time_spent: timeSpentInMinutes,
    });

    await worker.save();

    // Send response with remaining stock count
    return res.send({
      message: "Check-out successful",
      timeSpent: `${Math.floor(timeSpentInMinutes / 60)}hr ${Math.round(
        timeSpentInMinutes % 60
      )}min`,
      rowNumber: row.row_number,
      stockCount: calculatedStockCount,
      remainingStocks,
    });
  } catch (error) {
    console.error("Error during worker check-out:", error);
    return res.status(500).send({ message: "Server error", error });
  }
};

// Get row data by row number
exports.getRowByNumber = async (req, res) => {
  try {
    const { rowNumber } = req.params;
    const block = await Block.findOne({ block_name: blockName });

    if (!block) {
      return res.status(404).send({ message: "Block not found" });
    }

    const row = block.rows.find(
      (row) => row.row_number === parseInt(rowNumber)
    );

    if (!row) {
      return res.status(404).send({ message: "Row not found" });
    }

    res.send(row);
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
};

// Get all block data
exports.getAllBlockData = async (req, res) => {
  try {
    const block = await Block.findOne({ block_name: blockName });

    if (!block) {
      return res.status(404).json({ message: "Block data not found" });
    }

    res.json(block);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Get a block by name
exports.getBlockByName = async (req, res) => {
  try {
    const block = await Block.findOne({ block_name: blockName });

    if (!block) {
      return res.status(404).send({ message: "Block not found" });
    }

    res.send(block);
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
};

exports.getRemainingStocks = async (req, res) => {
  try {
    const block = await Block.findOne({ block_name: blockName });
    if (!block) {
      return res.status(404).send({ message: "Block not found" });
    }

    // Calculate total used stocks
    const totalUsedStocks = block.rows.reduce(
      (acc, row) => acc + row.stock_count,
      0
    );

    // Calculate remaining stocks
    const remainingStocks = block.total_stocks - totalUsedStocks;

    res.send({ remainingStocks });
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
};

exports.getRemainingStocksForRow = async (req, res) => {
  try {
    const { rowNumber } = req.params;

    // Find the block document that contains the specific row
    const block = await Block.findOne({
      "rows.row_number": parseInt(rowNumber),
    });

    if (!block) {
      return res.status(404).send({ message: "Block or Row not found" });
    }

    // Find the specific row within the block document
    const row = block.rows.find(
      (row) => row.row_number === parseInt(rowNumber)
    );

    if (!row) {
      return res.status(404).send({ message: "Row not found" });
    }

    // Calculate the total stocks accounted for by summing up all stock counts in rows
    const totalCountedStocks = block.rows.reduce(
      (total, row) => total + row.stock_count,
      0
    );

    // Calculate the remaining stocks for the specific row
    const remainingStocks =
      block.total_stocks - totalCountedStocks + row.stock_count;

    res.send({ rowNumber: row.row_number, remainingStocks });
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
};

// get workers
exports.getWorkers = async (req, res) => {
  try {
    const workers = await Worker.find({});
    res.send(workers);
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
};
