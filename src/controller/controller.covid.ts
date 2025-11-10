import { Request, Response } from "express";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

// Update the extension to .xlsx
const filePath = path.join(process.cwd(), "src", "controller", "data", "country_wise_latest_covid.xlsx");

export default function getCovidData(req: Request, res: Response) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found at: ${filePath}`);
      return res.status(500).json({ error: "Excel file not found" });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Paginate
    const paginatedData = jsonData.slice(startIndex, endIndex).map((row, index) => ({
      id: startIndex + index + 1,
      ...row
    }));

    const hasMore = endIndex < jsonData.length;

    res.status(200).json({
      page,
      limit,
      data: paginatedData,
      hasMore,
      total: jsonData.length
    });

  } catch (err) {
    console.error("Error reading Excel file:", err);
    res.status(500).json({ error: "Failed to load data." });
  }
}
