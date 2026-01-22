/**
 * PRD Parser Service
 *
 * Parses PRD.md files to extract specific phases and their content.
 * Supports parsing phases with sections and task items.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a section within a phase
 */
export interface PrdSection {
  name: string;
  content: string;
}

/**
 * Represents a phase extracted from a PRD file
 */
export interface PrdPhase {
  number: number;
  name: string;
  content: string; // Full markdown content of just this phase
  sections: PrdSection[];
}

/**
 * Service for parsing PRD markdown files
 */
class PrdParserService {
  /**
   * Regular expression patterns for parsing PRD structure
   */
  private static readonly PHASE_HEADER_PATTERN =
    /^##\s+Phase\s+(\d+)\s*[:\-]\s*(.+?)(?:\s*$)/i;

  private static readonly FINAL_PHASE_PATTERN =
    /^##\s+Final\s+Phase\s*[:\-]\s*(.+?)(?:\s*$)/i;

  private static readonly SECTION_HEADER_PATTERN = /^###\s+(\d+)\.(\d+)\s+(.+?)(?:\s*$)/;

  private static readonly FINAL_SECTION_HEADER_PATTERN =
    /^###\s+Final\.(\d+)\s+(.+?)(?:\s*$)/;

  /**
   * Parse a PRD file and return all phases
   *
   * @param filePath - Absolute path to the PRD.md file
   * @returns Array of parsed phases
   * @throws Error if file cannot be read
   */
  async parseFile(filePath: string): Promise<PrdPhase[]> {
    try {
      // Validate file path
      if (!filePath) {
        throw new Error('File path is required');
      }

      // Resolve to absolute path if needed
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`PRD file not found: ${absolutePath}`);
      }

      // Read file content
      const content = fs.readFileSync(absolutePath, 'utf-8');

      return this.parse(content);
    } catch (error) {
      console.error('[PRD Parser] Failed to parse file:', error);
      throw new Error(
        `Failed to parse PRD file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse PRD content string and return all phases
   *
   * @param content - Raw markdown content of the PRD file
   * @returns Array of parsed phases
   */
  parse(content: string): PrdPhase[] {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const phases: PrdPhase[] = [];
    const lines = content.split('\n');
    const phaseStartLines: number[] = [];

    // First pass: identify all phase start lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Check for regular phase header
      const phaseMatch = line.match(PrdParserService.PHASE_HEADER_PATTERN);
      if (phaseMatch) {
        phaseStartLines.push(i);
        continue;
      }

      // Check for "Final Phase" header
      const finalMatch = line.match(PrdParserService.FINAL_PHASE_PATTERN);
      if (finalMatch) {
        phaseStartLines.push(i);
      }
    }

    // Second pass: extract phase content
    for (let i = 0; i < phaseStartLines.length; i++) {
      const startLine = phaseStartLines[i] ?? 0;
      const nextStartLine = phaseStartLines[i + 1];
      const endLine = nextStartLine !== undefined ? nextStartLine : lines.length;

      const headerLine = lines[startLine] ?? '';
      const phaseLines = lines.slice(startLine, endLine);
      const phaseContent = phaseLines.join('\n').trim();

      // Parse phase header
      const phaseMatch = headerLine.match(PrdParserService.PHASE_HEADER_PATTERN);
      const finalMatch = headerLine.match(PrdParserService.FINAL_PHASE_PATTERN);

      if (phaseMatch && phaseMatch[1] && phaseMatch[2]) {
        const phaseNumber = parseInt(phaseMatch[1], 10);
        const phaseName = phaseMatch[2].trim();

        const phase: PrdPhase = {
          number: phaseNumber,
          name: phaseName,
          content: phaseContent,
          sections: this.extractSections(phaseLines, phaseNumber),
        };

        phases.push(phase);
      } else if (finalMatch && finalMatch[1]) {
        // Handle "Final Phase" as a special phase with number 999
        const phaseName = finalMatch[1].trim();

        const phase: PrdPhase = {
          number: 999, // Use 999 to indicate "Final Phase"
          name: phaseName,
          content: phaseContent,
          sections: this.extractFinalSections(phaseLines),
        };

        phases.push(phase);
      }
    }

    return phases;
  }

  /**
   * Extract sections from phase lines
   *
   * @param phaseLines - Array of lines within the phase
   * @param phaseNumber - The phase number (for section validation)
   * @returns Array of sections
   */
  private extractSections(phaseLines: string[], phaseNumber: number): PrdSection[] {
    const sections: PrdSection[] = [];
    const sectionStartLines: number[] = [];

    // Find all section headers
    for (let i = 0; i < phaseLines.length; i++) {
      const line = phaseLines[i] ?? '';
      const match = line.match(PrdParserService.SECTION_HEADER_PATTERN);
      if (match && match[1]) {
        const sectionPhaseNum = parseInt(match[1], 10);
        // Only include sections that belong to this phase
        if (sectionPhaseNum === phaseNumber) {
          sectionStartLines.push(i);
        }
      }
    }

    // Extract section content
    for (let i = 0; i < sectionStartLines.length; i++) {
      const startLine = sectionStartLines[i] ?? 0;
      const nextSectionStart = sectionStartLines[i + 1];
      const endLine = this.findSectionEnd(phaseLines, startLine, nextSectionStart);

      const headerLine = phaseLines[startLine] ?? '';
      const sectionLines = phaseLines.slice(startLine, endLine);
      const sectionContent = sectionLines.join('\n').trim();

      const match = headerLine.match(PrdParserService.SECTION_HEADER_PATTERN);
      if (match && match[3]) {
        const sectionName = match[3].trim();

        sections.push({
          name: sectionName,
          content: sectionContent,
        });
      }
    }

    return sections;
  }

  /**
   * Extract sections from "Final Phase" lines
   *
   * @param phaseLines - Array of lines within the final phase
   * @returns Array of sections
   */
  private extractFinalSections(phaseLines: string[]): PrdSection[] {
    const sections: PrdSection[] = [];
    const sectionStartLines: number[] = [];

    // Find all section headers with "Final.X" format
    for (let i = 0; i < phaseLines.length; i++) {
      const line = phaseLines[i] ?? '';
      const match = line.match(PrdParserService.FINAL_SECTION_HEADER_PATTERN);
      if (match) {
        sectionStartLines.push(i);
      }
    }

    // Extract section content
    for (let i = 0; i < sectionStartLines.length; i++) {
      const startLine = sectionStartLines[i] ?? 0;
      const nextSectionStart = sectionStartLines[i + 1];
      const endLine = this.findSectionEnd(phaseLines, startLine, nextSectionStart);

      const headerLine = phaseLines[startLine] ?? '';
      const sectionLines = phaseLines.slice(startLine, endLine);
      const sectionContent = sectionLines.join('\n').trim();

      const match = headerLine.match(PrdParserService.FINAL_SECTION_HEADER_PATTERN);
      if (match && match[2]) {
        const sectionName = match[2].trim();

        sections.push({
          name: sectionName,
          content: sectionContent,
        });
      }
    }

    return sections;
  }

  /**
   * Find the end line of a section
   *
   * @param lines - Array of lines to search
   * @param startLine - Starting line of current section
   * @param nextSectionStart - Starting line of next section (if any)
   * @returns End line index (exclusive)
   */
  private findSectionEnd(
    lines: string[],
    startLine: number,
    nextSectionStart: number | undefined
  ): number {
    // If there's a next section, end before it
    if (nextSectionStart !== undefined) {
      return nextSectionStart;
    }

    // Otherwise, find where the section ends (before any phase verification or major break)
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Check for phase verification marker
      if (/^\*\*Phase\s+\d+\s+Verification/i.test(line)) {
        return i;
      }

      // Check for horizontal rule (major section break)
      if (/^---\s*$/.test(line)) {
        return i;
      }
    }

    return lines.length;
  }

  /**
   * Extract a specific phase by number
   *
   * @param content - Raw markdown content of the PRD file
   * @param phaseNumber - The phase number to extract (use 999 for "Final Phase")
   * @returns The phase if found, null otherwise
   */
  getPhase(content: string, phaseNumber: number): PrdPhase | null {
    if (!content || typeof content !== 'string') {
      return null;
    }

    if (typeof phaseNumber !== 'number' || phaseNumber < 0) {
      return null;
    }

    const phases = this.parse(content);
    return phases.find((phase) => phase.number === phaseNumber) || null;
  }

  /**
   * Detect if a task description references a phase
   *
   * Matches patterns like:
   * - "Phase 1"
   * - "phase1"
   * - "Phase 1:"
   * - "phase 1 -"
   * - "Implement Phase 1"
   * - "Work on Phase 15"
   * - "Final Phase"
   *
   * @param description - Task description to search
   * @returns The phase number if found, null otherwise (999 for "Final Phase")
   */
  detectPhaseReference(description: string): number | null {
    if (!description || typeof description !== 'string') {
      return null;
    }

    // Check for "Final Phase" first
    const finalPattern = /\bfinal\s+phase\b/i;
    if (finalPattern.test(description)) {
      return 999;
    }

    // Pattern to match "Phase X" with various formats
    // - "Phase 1", "phase 1", "PHASE 1"
    // - "Phase1", "phase1"
    // - "Phase 1:", "Phase 1 -", "Phase 1."
    const phasePattern = /\bphase\s*(\d+)\b/i;
    const match = description.match(phasePattern);

    if (match && match[1]) {
      const phaseNumber = parseInt(match[1], 10);

      // Validate that the phase number is reasonable (1-999)
      if (phaseNumber >= 1 && phaseNumber <= 998) {
        return phaseNumber;
      }
    }

    return null;
  }

  /**
   * Get phase content as clean markdown suitable for use as a prompt
   *
   * @param phase - The phase to format
   * @returns Clean markdown content
   */
  formatPhaseAsPrompt(phase: PrdPhase): string {
    if (!phase) {
      return '';
    }

    // Remove the phase header from content (first line) and return rest
    const lines = phase.content.split('\n');

    // Skip the first line (phase header) and any immediately following blank lines
    let startIndex = 1;
    while (startIndex < lines.length && (lines[startIndex] ?? '').trim() === '') {
      startIndex++;
    }

    return lines.slice(startIndex).join('\n').trim();
  }

  /**
   * Check if a PRD file contains any phases
   *
   * @param content - Raw markdown content
   * @returns true if phases are found
   */
  hasPhases(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    return (
      PrdParserService.PHASE_HEADER_PATTERN.test(content) ||
      PrdParserService.FINAL_PHASE_PATTERN.test(content)
    );
  }

  /**
   * Get all phase numbers from content
   *
   * @param content - Raw markdown content
   * @returns Array of phase numbers found
   */
  getPhaseNumbers(content: string): number[] {
    const phases = this.parse(content);
    return phases.map((phase) => phase.number);
  }
}

// Export singleton instance
export const prdParser = new PrdParserService();

// Export class for testing purposes
export { PrdParserService };
