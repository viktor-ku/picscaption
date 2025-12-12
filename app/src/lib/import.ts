import Papa from "papaparse";
import type { MetaObject } from "./settings";

// Supported column names for filename matching (case-insensitive)
const FILENAME_COLUMNS = ["filename", "file_name", "file", "image"];

export interface ImportError {
  row: number;
  filename: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface ParsedRow {
  filename: string;
  values: Array<{
    metaObjectId: string;
    value: string | number;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  rows: ParsedRow[];
  errors: ImportError[];
}

/**
 * Find the filename column in CSV headers (case-insensitive).
 */
function findFilenameColumn(headers: string[]): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const candidate of FILENAME_COLUMNS) {
    const index = lowerHeaders.indexOf(candidate);
    if (index !== -1) {
      return headers[index];
    }
  }

  return null;
}

/**
 * Find a matching column for a metaobject name (case-insensitive).
 */
function findMetaColumn(headers: string[], metaName: string): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  const lowerMetaName = metaName.toLowerCase().trim();

  const index = lowerHeaders.indexOf(lowerMetaName);
  return index !== -1 ? headers[index] : null;
}

/**
 * Parse a value according to the metaobject type.
 * Returns null if the value cannot be parsed as the expected type.
 */
function parseValue(
  rawValue: string,
  type: "string" | "number",
): string | number | null {
  const trimmed = rawValue.trim();

  if (type === "number") {
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return null;
    return num;
  }

  return trimmed;
}

/**
 * Parse and validate a CSV file against active metaobjects.
 */
export function parseAndValidateCsv(
  csvContent: string,
  activeMetaObjects: MetaObject[],
): ValidationResult {
  const errors: ImportError[] = [];
  const rows: ParsedRow[] = [];

  // Parse CSV
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    // Report first parse error
    const firstError = parseResult.errors[0];
    errors.push({
      row: firstError.row ?? 0,
      filename: "",
      message: `CSV parse error: ${firstError.message}`,
    });
    return { valid: false, rows: [], errors };
  }

  const headers = parseResult.meta.fields || [];
  const data = parseResult.data;

  if (data.length === 0) {
    errors.push({
      row: 0,
      filename: "",
      message: "CSV file is empty or has no data rows",
    });
    return { valid: false, rows: [], errors };
  }

  // Find filename column
  const filenameColumn = findFilenameColumn(headers);
  if (!filenameColumn) {
    errors.push({
      row: 0,
      filename: "",
      message: "CSV must have a filename, file_name, file, or image column",
    });
    return { valid: false, rows: [], errors };
  }

  // Build column mapping for active metaobjects
  const columnMapping: Array<{
    metaObject: MetaObject;
    column: string | null;
  }> = activeMetaObjects.map((mo) => ({
    metaObject: mo,
    column: findMetaColumn(headers, mo.name),
  }));

  // Process each row
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2; // 1-indexed, accounting for header row
    const filename = row[filenameColumn]?.trim() || "";

    if (!filename) {
      errors.push({
        row: rowNumber,
        filename: "",
        message: "Missing filename",
      });
      continue;
    }

    const values: ParsedRow["values"] = [];
    let hasError = false;

    for (const { metaObject, column } of columnMapping) {
      const rawValue = column ? row[column] : undefined;

      // Check required fields
      if (metaObject.required) {
        if (!column) {
          errors.push({
            row: rowNumber,
            filename,
            message: `Missing required column '${metaObject.name}'`,
          });
          hasError = true;
          continue;
        }
        if (rawValue === undefined || rawValue.trim() === "") {
          errors.push({
            row: rowNumber,
            filename,
            message: `Missing required field '${metaObject.name}'`,
          });
          hasError = true;
          continue;
        }
      }

      // Skip if column doesn't exist or value is empty (for non-required)
      if (!column || rawValue === undefined || rawValue.trim() === "") {
        continue;
      }

      // Parse and validate value type
      const parsedValue = parseValue(rawValue, metaObject.type);
      if (parsedValue === null) {
        errors.push({
          row: rowNumber,
          filename,
          message: `Field '${metaObject.name}' must be a ${metaObject.type}`,
        });
        hasError = true;
        continue;
      }

      values.push({
        metaObjectId: metaObject._id,
        value: parsedValue,
      });
    }

    if (!hasError) {
      rows.push({ filename, values });
    }
  }

  return {
    valid: errors.length === 0,
    rows,
    errors,
  };
}

/**
 * Read a CSV file and return its content as a string.
 */
export function readCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === "string") {
        resolve(content);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Format import errors for display in a toast.
 */
export function formatImportErrors(errors: ImportError[]): string {
  if (errors.length === 0) return "";

  if (errors.length === 1) {
    return errors[0].message;
  }

  // Group by message type for cleaner display
  const byMessage = new Map<string, ImportError[]>();
  for (const error of errors) {
    const key = error.message;
    const existing = byMessage.get(key) || [];
    existing.push(error);
    byMessage.set(key, existing);
  }

  if (byMessage.size === 1) {
    const [message, errs] = [...byMessage.entries()][0];
    return `${errs.length} rows: ${message}`;
  }

  // Show first few unique error types
  const summaries: string[] = [];
  let remaining = errors.length;
  for (const [message, errs] of byMessage) {
    if (summaries.length >= 3) break;
    summaries.push(`${errs.length}× ${message}`);
    remaining -= errs.length;
  }

  if (remaining > 0) {
    summaries.push(`+${remaining} more`);
  }

  return summaries.join("; ");
}
