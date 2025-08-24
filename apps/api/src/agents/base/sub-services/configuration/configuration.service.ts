import { Injectable, Logger } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface ConfigurationOptions {
  /**
   * Whether to substitute environment variables in the configuration
   */
  substituteEnvVars?: boolean;

  /**
   * Whether to validate the configuration against a schema
   */
  validateSchema?: boolean;

  /**
   * Base directory for resolving relative file paths
   */
  baseDirectory?: string;

  /**
   * Custom environment variable prefix for substitution
   */
  envVarPrefix?: string;

  /**
   * Whether to throw errors on missing environment variables
   */
  strictEnvVars?: boolean;
}

export interface ParsedConfiguration<T = any> {
  /**
   * The parsed configuration object
   */
  data: T;

  /**
   * Any validation errors encountered
   */
  validationErrors?: ValidationError[];

  /**
   * Environment variables that were substituted
   */
  substitutedVars?: string[];

  /**
   * The source file path
   */
  sourcePath?: string;
}

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  /**
   * Parse a YAML file and return the configuration object
   */
  async parseYamlFile<T = any>(
    filePath: string,
    options: ConfigurationOptions = {},
  ): Promise<ParsedConfiguration<T>> {

    // Resolve the file path
    const resolvedPath = this.resolveFilePath(filePath, options.baseDirectory);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    try {
      // Read the file content
      const yamlContent = fs.readFileSync(resolvedPath, 'utf8');

      // Parse the YAML
      const parsed = yaml.load(yamlContent) as T;

      if (!parsed) {
        throw new Error(
          'Failed to parse YAML content - file appears to be empty or invalid',
        );
      }

      const result: ParsedConfiguration<T> = {
        data: parsed,
        sourcePath: resolvedPath,
      };

      // Substitute environment variables if requested
      if (options.substituteEnvVars !== false) {
        // Default to true
        const substitutionResult = this.substituteEnvVars(
          result.data,
          options.envVarPrefix,
          options.strictEnvVars,
        );
        result.data = substitutionResult.data;
        result.substitutedVars = substitutionResult.substitutedVars;
      }

      return result;
    } catch (error) {

      throw new Error(
        `Failed to parse YAML configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Substitute environment variables in a configuration object
   * Supports ${VAR_NAME} and ${VAR_NAME:default_value} syntax
   */
  substituteEnvVars<T = any>(
    config: T,
    envVarPrefix?: string,
    strict: boolean = false,
  ): { data: T; substitutedVars: string[] } {
    const substitutedVars: string[] = [];

    const substitute = (obj: any): any => {
      if (typeof obj === 'string') {
        return this.substituteStringEnvVars(
          obj,
          envVarPrefix,
          strict,
          substitutedVars,
        );
      } else if (Array.isArray(obj)) {
        return obj.map(substitute);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = substitute(value);
        }
        return result;
      }
      return obj;
    };

    const data = substitute(config);

    if (substitutedVars.length > 0) {

    }

    return { data, substitutedVars };
  }

  /**
   * Substitute environment variables in a single string
   */
  private substituteStringEnvVars(
    str: string,
    envVarPrefix: string | undefined,
    strict: boolean,
    substitutedVars: string[],
  ): string {
    // Match ${VAR_NAME} or ${VAR_NAME:default_value}
    const envVarRegex = /\$\{([^}:]+)(?::([^}]*))?\}/g;

    return str.replace(envVarRegex, (match, varName, defaultValue) => {
      const fullVarName = envVarPrefix ? `${envVarPrefix}${varName}` : varName;
      const envValue = process.env[fullVarName];

      if (envValue !== undefined) {
        substitutedVars.push(fullVarName);
        return envValue;
      } else if (defaultValue !== undefined) {

        return defaultValue;
      } else if (strict) {
        throw new Error(
          `Required environment variable not found: ${fullVarName}`,
        );
      } else {

        return match; // Keep the original placeholder
      }
    });
  }

  /**
   * Validate a configuration object against a class-validator schema
   */
  async validateSchema<T extends object>(
    config: T,
    SchemaClass: new () => T,
  ): Promise<ValidationError[]> {

    try {
      // Create an instance of the schema class and copy properties
      const instance = new SchemaClass();
      Object.assign(instance, config);

      // Validate using class-validator
      const errors = await validate(instance, {
        whitelist: true, // Strip properties that don't have decorators
        forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      });

      if (errors.length > 0) {

        errors.forEach((error) => {

        });
      } else {

      }

      return errors;
    } catch (error) {

      throw new Error(
        `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Resolve a file path, handling both absolute and relative paths
   */
  resolveFilePath(filePath: string, baseDirectory?: string): string {
    // If it's already an absolute path, return as-is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // If no base directory provided, use current working directory
    const base = baseDirectory || process.cwd();

    // Resolve relative path
    const resolved = path.resolve(base, filePath);

    return resolved;
  }

  /**
   * Check if a file exists at the given path
   */
  fileExists(filePath: string, baseDirectory?: string): boolean {
    const resolvedPath = this.resolveFilePath(filePath, baseDirectory);
    return fs.existsSync(resolvedPath);
  }

  /**
   * Get file stats for a configuration file
   */
  getFileStats(filePath: string, baseDirectory?: string): fs.Stats | null {
    const resolvedPath = this.resolveFilePath(filePath, baseDirectory);

    try {
      return fs.statSync(resolvedPath);
    } catch (error) {

      return null;
    }
  }

  /**
   * Parse YAML content from a string (useful for testing or dynamic content)
   */
  parseYamlString<T = any>(
    yamlContent: string,
    options: ConfigurationOptions = {},
  ): ParsedConfiguration<T> {

    try {
      const parsed = yaml.load(yamlContent) as T;

      if (!parsed) {
        throw new Error(
          'Failed to parse YAML content - content appears to be empty or invalid',
        );
      }

      const result: ParsedConfiguration<T> = {
        data: parsed,
      };

      // Substitute environment variables if requested
      if (options.substituteEnvVars !== false) {
        // Default to true
        const substitutionResult = this.substituteEnvVars(
          result.data,
          options.envVarPrefix,
          options.strictEnvVars,
        );
        result.data = substitutionResult.data;
        result.substitutedVars = substitutionResult.substitutedVars;
      }

      return result;
    } catch (error) {

      throw new Error(
        `Failed to parse YAML content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Write a configuration object back to a YAML file
   */
  async writeYamlFile<T = any>(
    filePath: string,
    config: T,
    options: ConfigurationOptions = {},
  ): Promise<void> {
    const resolvedPath = this.resolveFilePath(filePath, options.baseDirectory);

    try {
      // Convert object to YAML string
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });

      // Ensure directory exists
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(resolvedPath, yamlContent, 'utf8');

    } catch (error) {

      throw new Error(
        `Failed to write YAML configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
