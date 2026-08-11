import fs from "fs";
import path from "path";
import { FileStorageHelper as BaseFileStorageHelper } from "@churchapps/apihelper";
import { Environment } from "./Environment.js";

/**
 * Custom FileStorageHelper implementation for the monolith
 * Wraps the base helper from @churchapps/apihelper to use local storage
 * instead of AWS S3 when FILE_STORE=local
 */
export class CustomFileStorageHelper {
  /**
   * Store a file using local storage instead of AWS S3
   */
  static async store(key: string, contentType: string, buffer: Buffer): Promise<void> {
    // If FILE_STORE is set to local, use local filesystem
    if (Environment.fileStore === "local") {
      return this.storeLocal(key, buffer);
    }

    // Otherwise, use the base implementation (AWS S3)
    return await BaseFileStorageHelper.store(key, contentType, buffer);
  }

  /**
   * Store file locally in the content directory
   */
  private static async storeLocal(key: string, buffer: Buffer): Promise<void> {
    try {
      // Ensure the content directory exists
      const contentDir = path.join(process.cwd(), "content");
      if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
      }

      // Build the full file path
      const filePath = path.join(contentDir, key);
      const dir = path.dirname(filePath);

      // Ensure the directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      console.error("Error storing file locally:", error);
      throw new Error(`Failed to store file locally: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove a file from local storage
   */
  static async remove(key: string): Promise<void> {
    // If FILE_STORE is set to local, remove from local filesystem
    if (Environment.fileStore === "local") {
      return this.removeLocal(key);
    }

    // Otherwise, use the base implementation (AWS S3)
    return await BaseFileStorageHelper.remove(key);
  }

  /**
   * Remove file from local filesystem
   */
  private static async removeLocal(key: string): Promise<void> {
    try {
      const filePath = path.join(process.cwd(), "content", key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Error removing file locally:", error);
      // Don't throw - deletion failures should be non-critical
    }
  }

  /**
   * Remove a folder from local storage
   */
  static async removeFolder(key: string): Promise<void> {
    // If FILE_STORE is set to local, remove from local filesystem
    if (Environment.fileStore === "local") {
      return this.removeLocalFolder(key);
    }

    // Otherwise, use the base implementation (AWS S3)
    return await BaseFileStorageHelper.removeFolder(key);
  }

  /**
   * Remove folder from local filesystem
   */
  private static async removeLocalFolder(key: string): Promise<void> {
    try {
      const folderPath = path.join(process.cwd(), "content", key);
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error("Error removing folder locally:", error);
      // Don't throw - deletion failures should be non-critical
    }
  }

  /**
   * Move a file in local storage
   */
  static async move(oldKey: string, newKey: string): Promise<void> {
    // If FILE_STORE is set to local, move in local filesystem
    if (Environment.fileStore === "local") {
      return this.moveLocal(oldKey, newKey);
    }

    // Otherwise, use the base implementation (AWS S3)
    return await BaseFileStorageHelper.move(oldKey, newKey);
  }

  /**
   * Move file in local filesystem
   */
  private static async moveLocal(oldKey: string, newKey: string): Promise<void> {
    try {
      const oldPath = path.join(process.cwd(), "content", oldKey);
      const newPath = path.join(process.cwd(), "content", newKey);
      const newDir = path.dirname(newPath);

      // Ensure the new directory exists
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      // Move the file
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    } catch (error) {
      console.error("Error moving file locally:", error);
      throw new Error(`Failed to move file locally: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List files in a local directory
   */
  static async list(filePath: string): Promise<string[]> {
    // If FILE_STORE is set to local, list from local filesystem
    if (Environment.fileStore === "local") {
      return this.listLocal(filePath);
    }

    // Otherwise, use the base implementation (AWS S3)
    return await BaseFileStorageHelper.list(filePath);
  }

  /**
   * List files in local filesystem
   */
  private static async listLocal(filePath: string): Promise<string[]> {
    try {
      const dirPath = path.join(process.cwd(), "content", filePath);
      if (fs.existsSync(dirPath)) {
        return fs.readdirSync(dirPath);
      }
      return [];
    } catch (error) {
      console.error("Error listing files locally:", error);
      return [];
    }
  }
}
