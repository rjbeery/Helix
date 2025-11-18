import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

/**
 * Extract text content from various file formats
 */
export class DocumentParser {
  constructor() {}
  /**
   * Parse a file and extract text content
   */
  async parseFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.txt':
      case '.md':
      case '.tex':
      case '.json':
      case '.csv':
      case '.log':
        return this.parseTextFile(filePath);
      
      case '.pdf':
        throw new Error('PDF parsing temporarily disabled');
      
      case '.docx':
        return this.parseDOCX(filePath);
      
      default:
        throw new Error(`Unsupported file type: ${ext}. Supported: .txt, .md, .tex, .pdf, .docx, .json, .csv`);
    }
  }

  /**
   * Parse plain text files (including .tex)
   */
  private async parseTextFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  // PDF parsing removed

  /**
   * Parse DOCX files
   */
  private async parseDOCX(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  /**
   * Parse from buffer (useful for API uploads)
   */
  async parseBuffer(buffer: Buffer, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    
    switch (ext) {
      case '.txt':
      case '.md':
      case '.tex':
      case '.json':
      case '.csv':
        return buffer.toString('utf-8');
      
      case '.pdf':
        throw new Error('PDF parsing temporarily disabled');
      
      case '.docx':
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }
}

export const documentParser = new DocumentParser();
