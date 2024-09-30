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

    // Assign the worker and set the start time
    row.worker_name = workerName;
    row.worker_id = workerID; // Store workerID for reference
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
    return res.json({ message: "Check-in successful", row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Check-out a worker
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

    let calculatedStockCount = stockCount;
    if (typeof stockCount !== "number" || isNaN(stockCount)) {
      calculatedStockCount = row.stock_count;
    } else if (stockCount > row.stock_count) {
      return res
        .status(400)
        .send({ message: "Invalid stock count: exceeds available stocks" });
    }

    // Convert minutes to hours and minutes
    const hours = Math.floor(timeSpentInMinutes / 60);
    const minutes = Math.round(timeSpentInMinutes % 60);
    const formattedTimeSpent = `${hours}hr ${minutes}min`;

    // Update or create the worker
    let worker = await Worker.findOne({ workerID: workerID });
    if (!worker) {
      // Create new worker if it does not exist
      worker = new Worker({
        workerID: workerID,
        name: workerName,
        blocks: [{ block_name: blockName, rows: [] }],
      });
    }

    // Update the worker's block and rows
    const blockIndex = worker.blocks.findIndex(
      (b) => b.block_name === blockName
    );
    const currentDate = new Date(); // Capture the current date

    if (blockIndex === -1) {
      // Add block if it does not exist
      worker.blocks.push({
        block_name: blockName,
        rows: [
          {
            row_number: rowNumber,
            stock_count: calculatedStockCount,
            time_spent: timeSpentInMinutes,
            date: currentDate, // Add the current date to the row
            day_of_week: new Date().toLocaleDateString("en-US", {
              weekday: "long",
            }), // Add the day of the week
          },
        ],
      });
    } else {
      // Update existing block
      const rowIndex = worker.blocks[blockIndex].rows.findIndex(
        (r) => r.row_number === rowNumber
      );
      if (rowIndex === -1) {
        // Add new row if it does not exist
        worker.blocks[blockIndex].rows.push({
          row_number: rowNumber,
          stock_count: calculatedStockCount,
          time_spent: timeSpentInMinutes,
          date: currentDate, // Add the current date to the row
          day_of_week: new Date().toLocaleDateString("en-US", {
            weekday: "long",
          }), // Add the day of the week
        });
      } else {
        // Update existing row
        worker.blocks[blockIndex].rows[rowIndex] = {
          row_number: rowNumber,
          stock_count: calculatedStockCount,
          time_spent: timeSpentInMinutes,
          date: currentDate, // Add the current date to the row
          day_of_week: new Date().toLocaleDateString("en-US", {
            weekday: "long",
          }), // Add the day of the week
        };
      }
    }

    // Increment total stock count
    worker.total_stock_count += calculatedStockCount;
    await worker.save();

    // Clear worker from the row in the Block collection
    row.worker_name = "";
    row.worker_id = "";
    row.start_time = null;
    row.time_spent = null;
    await block.save();

    res.send({
      message: "Check-out successful",
      timeSpent: formattedTimeSpent,
      rowNumber: row.row_number,
      stockCount: calculatedStockCount,
    });
  } catch (error) {
    console.error("Error during worker check-out:", error);
    res.status(500).send({ message: "Server error", error });
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
