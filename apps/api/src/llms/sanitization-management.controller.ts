import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SecretRedactionService } from './secret-redaction.service';
import { PIIPatternService, PIIDataType } from './pii-pattern.service';
import { PseudonymizationService } from './pseudonymization.service';
import { DataSanitizationService } from './data-sanitization.service';
import { SupabaseService } from '../supabase/supabase.service';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, Min, Max } from 'class-validator';

// DTO Classes for API validation
class CreateRedactionPatternDto {
  @IsString()
  name!: string;

  @IsString()
  pattern!: string;

  @IsString()
  replacement!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  priority?: number;
}

class CreatePIIPatternDto {
  @IsString()
  name!: string;

  @IsString()
  pattern!: string;

  @IsEnum(['email', 'phone', 'name', 'address', 'ip_address', 'username', 'credit_card', 'ssn', 'custom'])
  dataType!: PIIDataType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  priority?: number;
}

class TestSanitizationDto {
  @IsString()
  text!: string;

  @IsBoolean()
  @IsOptional()
  enableRedaction?: boolean;

  @IsBoolean()
  @IsOptional()
  enablePseudonymization?: boolean;

  @IsString()
  @IsOptional()
  context?: string;
}

class CreatePseudonymDictionaryDto {
  @IsEnum(['email', 'phone', 'name', 'address', 'ip_address', 'username', 'credit_card', 'ssn', 'custom'])
  dataType!: PIIDataType;

  @IsString()
  category!: string;

  @IsArray()
  @IsString({ each: true })
  words!: string[];

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  frequencyWeight?: number;
}

class UpdatePseudonymDictionaryDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  words?: string[];

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  frequencyWeight?: number;
}

@ApiTags('Sanitization Management')
@Controller('llm/sanitization')
export class SanitizationManagementController {
  constructor(
    private readonly secretRedactionService: SecretRedactionService,
    private readonly piiPatternService: PIIPatternService,
    private readonly pseudonymizationService: PseudonymizationService,
    private readonly dataSanitizationService: DataSanitizationService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // =====================================
  // REDACTION PATTERN ENDPOINTS
  // =====================================

  @Get('redaction/patterns')
  @ApiOperation({ summary: 'Get all redaction patterns' })
  @ApiResponse({ status: 200, description: 'List of redaction patterns' })
  async getRedactionPatterns() {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Query redaction patterns from database (excluding PII patterns)
      const { data: dbPatterns, error } = await client
        .from('redaction_patterns')
        .select('*')
        .not('category', 'in', '(pii_custom,pii_builtin)')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error && error.code !== '42P01') { // Ignore table not exists error
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Get built-in patterns from service
      const builtinPatterns = this.secretRedactionService.getRedactionPatterns();
      
      // Format database patterns to match service structure
      const formattedDbPatterns = (dbPatterns || []).map(pattern => ({
        id: pattern.id,
        name: pattern.name,
        pattern: pattern.pattern_regex, // Store as string
        replacement: pattern.replacement,
        description: pattern.description || '',
        priority: pattern.priority || 50,
        category: pattern.category,
        isActive: pattern.is_active,
        isCustom: true,
        createdAt: pattern.created_at,
        lastUsed: pattern.last_used_at,
        usageCount: pattern.usage_count || 0,
      }));

      // Combine database patterns with built-in patterns
      const allPatterns = [
        ...formattedDbPatterns,
        ...builtinPatterns.map(p => ({
          ...p,
          isCustom: false,
          category: 'builtin',
          isActive: true,
        }))
      ];
      
      // Get stats from service and enhance with database info
      const serviceStats = this.secretRedactionService.getStats();
      const dbStats = {
        customPatterns: formattedDbPatterns.length,
        activeCustomPatterns: formattedDbPatterns.filter(p => p.isActive).length,
        totalDatabasePatterns: formattedDbPatterns.length,
      };
      
      return {
        patterns: allPatterns,
        stats: {
          ...serviceStats,
          ...dbStats,
          totalPatterns: allPatterns.length,
          builtInPatterns: allPatterns.filter(p => !p.isCustom).length,
          customPatterns: allPatterns.filter(p => p.isCustom).length,
        },
        totalPatterns: allPatterns.length,
      };
    } catch (error) {
      // Fallback to service patterns if database fails
      console.error('Database query failed, falling back to service patterns:', error);
      const patterns = this.secretRedactionService.getRedactionPatterns();
      const stats = this.secretRedactionService.getStats();
      
      return {
        patterns: patterns.map(p => ({ ...p, isCustom: false, category: 'builtin' })),
        stats: {
          ...stats,
          databaseError: error instanceof Error ? error.message : 'Unknown error',
        },
        totalPatterns: patterns.length,
      };
    }
  }

  @Post('redaction/patterns')
  @ApiOperation({ summary: 'Add custom redaction pattern' })
  @ApiResponse({ status: 201, description: 'Pattern created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid pattern data' })
  @UsePipes(new ValidationPipe())
  async addRedactionPattern(@Body() createPatternDto: CreateRedactionPatternDto) {
    try {
      // Validate regex pattern
      new RegExp(createPatternDto.pattern);
      
      this.secretRedactionService.addRedactionPattern({
        name: createPatternDto.name,
        pattern: new RegExp(createPatternDto.pattern, 'gi'),
        replacement: createPatternDto.replacement,
        description: createPatternDto.description || '',
      });

      return {
        success: true,
        message: `Redaction pattern '${createPatternDto.name}' added successfully`,
        pattern: createPatternDto,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Delete('redaction/patterns/:name')
  @ApiOperation({ summary: 'Remove redaction pattern by name' })
  @ApiParam({ name: 'name', description: 'Pattern name to remove' })
  @ApiResponse({ status: 200, description: 'Pattern removed successfully' })
  @ApiResponse({ status: 404, description: 'Pattern not found' })
  async removeRedactionPattern(@Param('name') name: string) {
    const success = this.secretRedactionService.removeRedactionPattern(name);
    
    return {
      success,
      message: success 
        ? `Redaction pattern '${name}' removed successfully`
        : `Redaction pattern '${name}' not found`,
    };
  }

  @Post('redaction/test')
  @ApiOperation({ summary: 'Test redaction patterns against sample text' })
  @ApiResponse({ status: 200, description: 'Redaction test results' })
  @HttpCode(HttpStatus.OK)
  async testRedaction(@Body('text') text: string) {
    if (!text) {
      return {
        success: false,
        message: 'Text is required for testing',
      };
    }

    const result = this.secretRedactionService.testRedaction(text);
    
    return {
      success: true,
      originalText: text,
      redactedText: result.redactedText,
      result: result.result,
      patternDetails: result.patternDetails,
    };
  }

  // =====================================
  // PII PATTERN ENDPOINTS  
  // =====================================

  @Get('pii/patterns')
  @ApiOperation({ summary: 'Get all PII detection patterns' })
  @ApiQuery({ name: 'dataType', required: false, description: 'Filter by data type' })
  @ApiResponse({ status: 200, description: 'List of PII patterns' })
  async getPIIPatterns(@Query('dataType') dataType?: PIIDataType) {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Query PII patterns from database (category = 'pii_custom' or 'pii_builtin')
      let query = client
        .from('redaction_patterns')
        .select('*')
        .or('category.eq.pii_custom,category.eq.pii_builtin')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      const { data: dbPatterns, error } = await query;

      if (error && error.code !== '42P01') { // Ignore table not exists error
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Format database patterns to match expected structure
      const formattedDbPatterns = (dbPatterns || []).map(pattern => ({
        id: pattern.id,
        name: pattern.name,
        dataType: this.extractDataTypeFromPattern(pattern.pattern_regex, pattern.name),
        pattern: pattern.pattern_regex, // Store as string, will be converted to RegExp when used
        description: pattern.description || '',
        priority: pattern.priority || 50,
        enabled: pattern.is_active,
        isCustom: pattern.category === 'pii_custom',
        category: pattern.category,
        replacement: pattern.replacement,
        createdAt: pattern.created_at,
        lastUsed: pattern.last_used_at,
        usageCount: pattern.usage_count || 0,
      }));

      // Use only database patterns (service now loads from database too, so no need to combine)
      const allPatterns = formattedDbPatterns;

      // Apply dataType filter if specified
      const filteredPatterns = dataType 
        ? allPatterns.filter(p => p.dataType === dataType)
        : allPatterns;
      
      // Get stats from service (now database-only)
      const serviceStats = this.piiPatternService.getStats();
      const dbStats = {
        customPatterns: formattedDbPatterns.filter(p => p.category === 'pii_custom').length,
        activeCustomPatterns: formattedDbPatterns.filter(p => p.enabled && p.category === 'pii_custom').length,
        totalDatabasePatterns: formattedDbPatterns.length,
      };
      
      return {
        patterns: filteredPatterns,
        stats: {
          ...serviceStats,
          ...dbStats,
          totalPatterns: allPatterns.length,
          builtInPatterns: allPatterns.filter(p => !p.isCustom).length,
          customPatterns: allPatterns.filter(p => p.isCustom).length,
        },
        totalPatterns: filteredPatterns.length,
        dataTypes: ['email', 'phone', 'name', 'address', 'ip_address', 'username', 'credit_card', 'ssn', 'custom'],
      };
    } catch (error) {
      // Fallback to service patterns if database fails
      console.error('Database query failed, falling back to service patterns:', error);
      const allPatterns = this.piiPatternService.getAllPatterns();
      const filteredPatterns = dataType 
        ? allPatterns.filter(p => p.dataType === dataType)
        : allPatterns;
      
      const stats = this.piiPatternService.getStats();
      
      return {
        patterns: filteredPatterns,
        stats: {
          ...stats,
          databaseError: error instanceof Error ? error.message : 'Unknown error',
        },
        totalPatterns: filteredPatterns.length,
        dataTypes: ['email', 'phone', 'name', 'address', 'ip_address', 'username', 'credit_card', 'ssn', 'custom'],
      };
    }
  }

  @Post('pii/patterns')
  @ApiOperation({ summary: 'Add custom PII detection pattern' })
  @ApiResponse({ status: 201, description: 'PII pattern created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid pattern data' })
  @UsePipes(new ValidationPipe())
  async addPIIPattern(@Body() createPatternDto: CreatePIIPatternDto) {
    try {
      // Validate regex pattern
      const regex = new RegExp(createPatternDto.pattern, 'g');
      
      await this.piiPatternService.addCustomPattern({
        name: createPatternDto.name,
        dataType: createPatternDto.dataType,
        pattern: regex,
        description: createPatternDto.description || '',
        priority: createPatternDto.priority,
      });

      return {
        success: true,
        message: `PII pattern '${createPatternDto.name}' added successfully`,
        pattern: createPatternDto,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add PII pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Post('pii/test')
  @ApiOperation({ summary: 'Test PII detection patterns against sample text' })
  @ApiResponse({ status: 200, description: 'PII detection test results' })
  @HttpCode(HttpStatus.OK)
  async testPIIDetection(
    @Body('text') text: string,
    @Body('dataTypes') dataTypes?: PIIDataType[],
    @Body('minConfidence') minConfidence?: number
  ) {
    if (!text) {
      return {
        success: false,
        message: 'Text is required for testing',
      };
    }

    const result = await this.piiPatternService.detectPII(text, {
      dataTypes,
      minConfidence: minConfidence || 0.7,
      maxMatches: 50,
    });
    
    return {
      success: true,
      originalText: text,
      detectionResult: result,
      matchCount: result.matches.length,
      processingTime: result.processingTime,
    };
  }

  @Put('pii/patterns/:name')
  @ApiOperation({ summary: 'Update existing PII pattern' })
  @ApiParam({ name: 'name', description: 'Pattern name to update' })
  @ApiResponse({ status: 200, description: 'PII pattern updated successfully' })
  @ApiResponse({ status: 404, description: 'Pattern not found' })
  @UsePipes(new ValidationPipe())
  async updatePIIPattern(@Param('name') name: string, @Body() updatePatternDto: CreatePIIPatternDto) {
    try {
      // Update in database
      const client = this.supabaseService.getServiceClient();
      const { error } = await client
        .from('redaction_patterns')
        .update({
          name: updatePatternDto.name,
          pattern_regex: updatePatternDto.pattern,
          description: updatePatternDto.description || '',
          priority: updatePatternDto.priority || 50,
        })
        .eq('name', name)
        .eq('category', 'pii_custom');

      if (error) {
        throw new Error(error.message);
      }

      // Force reload patterns from database
      await this.piiPatternService.forceReload();

      return {
        success: true,
        message: `PII pattern '${name}' updated successfully`,
        pattern: updatePatternDto,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update PII pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Delete('pii/patterns/:name')
  @ApiOperation({ summary: 'Delete PII pattern by name' })
  @ApiParam({ name: 'name', description: 'Pattern name to delete' })
  @ApiResponse({ status: 200, description: 'PII pattern deleted successfully' })
  @ApiResponse({ status: 404, description: 'Pattern not found' })
  async deletePIIPattern(@Param('name') name: string) {
    try {
      // Remove from database
      const client = this.supabaseService.getServiceClient();
      const { error } = await client
        .from('redaction_patterns')
        .delete()
        .eq('name', name)
        .eq('category', 'pii_custom');

      if (error) {
        throw new Error(error.message);
      }

      // Force reload patterns from database
      await this.piiPatternService.forceReload();

      return {
        success: true,
        message: `PII pattern '${name}' deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete PII pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Get('pii/patterns/:dataType')
  @ApiOperation({ summary: 'Get PII patterns by data type' })
  @ApiParam({ name: 'dataType', enum: ['email', 'phone', 'name', 'address', 'ip_address', 'username', 'credit_card', 'ssn', 'custom'] })
  @ApiResponse({ status: 200, description: 'PII patterns for specified data type' })
  async getPIIPatternsByType(@Param('dataType') dataType: PIIDataType) {
    const patterns = this.piiPatternService.getPatternsByDataType(dataType);
    
    return {
      dataType,
      patterns,
      count: patterns.length,
    };
  }

  // =====================================
  // PSEUDONYMIZATION ENDPOINTS
  // =====================================

  @Post('pseudonym/generate')
  @ApiOperation({ summary: 'Generate pseudonym for a specific value' })
  @ApiResponse({ status: 200, description: 'Pseudonym generated successfully' })
  async generatePseudonym(
    @Body('value') value: string,
    @Body('dataType') dataType: PIIDataType,
    @Body('context') context?: string
  ) {
    if (!value || !dataType) {
      return {
        success: false,
        message: 'Value and dataType are required',
      };
    }

    try {
      const result = await this.pseudonymizationService.generatePseudonym(value, dataType, context);
      
      return {
        success: true,
        originalValue: value,
        pseudonym: result.pseudonym,
        dataType: result.dataType,
        isNew: result.isNew,
        context: result.context,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate pseudonym: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Post('pseudonym/lookup')
  @ApiOperation({ summary: 'Lookup existing pseudonym' })
  @ApiResponse({ status: 200, description: 'Pseudonym lookup result' })
  @HttpCode(HttpStatus.OK)
  async lookupPseudonym(
    @Body('value') value: string,
    @Body('dataType') dataType: PIIDataType
  ) {
    if (!value || !dataType) {
      return {
        success: false,
        message: 'Value and dataType are required',
      };
    }

    const pseudonym = await this.pseudonymizationService.lookupPseudonym(value, dataType);
    
    return {
      success: true,
      originalValue: value,
      dataType,
      pseudonym,
      found: !!pseudonym,
    };
  }

  @Get('pseudonym/stats')
  @ApiOperation({ summary: 'Get pseudonymization service statistics' })
  @ApiResponse({ status: 200, description: 'Pseudonymization statistics' })
  async getPseudonymizationStats() {
    const stats = await this.pseudonymizationService.getStats();
    
    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('pseudonym/dictionaries')
  @ApiOperation({ summary: 'Get all pseudonym dictionaries' })
  @ApiResponse({ status: 200, description: 'List of pseudonym dictionaries' })
  async getPseudonymDictionaries() {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Query pseudonym dictionary data from database - actual structure is individual rows per value
      const { data: dictionaryEntries, error } = await client
        .from('pseudonym_dictionaries')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) {
        // If table doesn't exist, return empty result
        if (error.code === '42P01') {
          return {
            dictionaries: [],
            totalDictionaries: 0,
            totalWords: 0,
            categories: [],
            stats: {
              activeDictionaries: 0,
              builtInDictionaries: 0,
              customDictionaries: 0,
            },
          };
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Group the individual dictionary entries by category
      const groupedEntries = (dictionaryEntries || []).reduce((groups, entry) => {
        const key = `${entry.data_type}-${entry.category}`;
        if (!groups[key]) {
          groups[key] = {
            id: entry.category, // Use category as ID for grouping
            category: entry.category,
            name: entry.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            description: `${entry.category.replace(/_/g, ' ')} for ${entry.data_type} pseudonymization`,
            dataType: entry.data_type,
            words: [],
            isActive: entry.is_active,
            isBuiltIn: true, // All current entries are built-in
            lastUpdated: entry.created_at,
          };
        }
        groups[key].words.push(entry.value);
        return groups;
      }, {} as Record<string, any>);

      // Convert grouped entries to array and add word counts
      const formattedDictionaries = Object.values(groupedEntries).map((dict: any) => ({
        ...dict,
        wordsCount: dict.words.length,
      }));

      const totalWords = formattedDictionaries.reduce((sum, dict) => sum + dict.wordsCount, 0);
      const categories = [...new Set(formattedDictionaries.map(d => d.category))];

      return {
        dictionaries: formattedDictionaries,
        totalDictionaries: formattedDictionaries.length,
        totalWords,
        categories,
        stats: {
          activeDictionaries: formattedDictionaries.filter(d => d.isActive).length,
          builtInDictionaries: formattedDictionaries.filter(d => d.isBuiltIn).length,
          customDictionaries: formattedDictionaries.filter(d => !d.isBuiltIn).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to load dictionaries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dictionaries: [],
        totalDictionaries: 0,
        totalWords: 0,
      };
    }
  }

  @Get('pseudonym/dictionaries/:id')
  @ApiOperation({ summary: 'Get pseudonym dictionary by ID' })
  @ApiParam({ name: 'id', description: 'Dictionary ID' })
  @ApiResponse({ status: 200, description: 'Pseudonym dictionary found' })
  @ApiResponse({ status: 404, description: 'Dictionary not found' })
  async getPseudonymDictionary(@Param('id') id: string) {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Query all entries for this dictionary category (since the DB structure stores individual values)
      const { data: dictionaryEntries, error } = await client
        .from('pseudonym_dictionaries')
        .select('*')
        .eq('category', id) // Using category as ID for grouping
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!dictionaryEntries || dictionaryEntries.length === 0) {
        return {
          success: false,
          message: 'Dictionary not found',
        };
      }

      // Group the entries into a single dictionary object
      const firstEntry = dictionaryEntries[0];
      const dictionary = {
        id: firstEntry.category,
        category: firstEntry.category,
        name: firstEntry.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: `${firstEntry.category.replace(/_/g, ' ')} for ${firstEntry.data_type} pseudonymization`,
        dataType: firstEntry.data_type,
        words: dictionaryEntries.map(entry => entry.value),
        isActive: firstEntry.is_active,
        isBuiltIn: true,
        lastUpdated: firstEntry.created_at,
        wordsCount: dictionaryEntries.length,
        locale: firstEntry.locale || 'en-US',
        frequencyWeight: firstEntry.frequency_weight || 1,
      };

      return {
        success: true,
        dictionary,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to load dictionary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Post('pseudonym/dictionaries')
  @ApiOperation({ summary: 'Create new pseudonym dictionary' })
  @ApiResponse({ status: 201, description: 'Dictionary created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @UsePipes(new ValidationPipe())
  async createPseudonymDictionary(@Body() createDto: CreatePseudonymDictionaryDto) {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Insert each word as a separate row in the dictionary table
      const insertData = createDto.words.map(word => ({
        data_type: createDto.dataType,
        category: createDto.category,
        value: word.trim(),
        locale: createDto.locale || 'en-US',
        frequency_weight: createDto.frequencyWeight || 1,
        is_active: createDto.isActive !== false, // Default to true
      }));

      const { data, error } = await client
        .from('pseudonym_dictionaries')
        .insert(insertData)
        .select();

      if (error) {
        throw new Error(`Failed to create dictionary: ${error.message}`);
      }

      // Return formatted dictionary object
      const dictionary = {
        id: createDto.category,
        category: createDto.category,
        name: createDto.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: createDto.description || `${createDto.category.replace(/_/g, ' ')} for ${createDto.dataType} pseudonymization`,
        dataType: createDto.dataType,
        words: createDto.words,
        isActive: createDto.isActive !== false,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wordsCount: createDto.words.length,
        locale: createDto.locale || 'en-US',
        frequencyWeight: createDto.frequencyWeight || 1,
      };

      return {
        success: true,
        message: 'Dictionary created successfully',
        dictionary,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create dictionary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Put('pseudonym/dictionaries/:id')
  @ApiOperation({ summary: 'Update pseudonym dictionary' })
  @ApiParam({ name: 'id', description: 'Dictionary ID (category)' })
  @ApiResponse({ status: 200, description: 'Dictionary updated successfully' })
  @ApiResponse({ status: 404, description: 'Dictionary not found' })
  @UsePipes(new ValidationPipe())
  async updatePseudonymDictionary(@Param('id') id: string, @Body() updateDto: UpdatePseudonymDictionaryDto) {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // First, check if dictionary exists
      const { data: existingEntries, error: checkError } = await client
        .from('pseudonym_dictionaries')
        .select('*')
        .eq('category', id);

      if (checkError) {
        throw new Error(`Database query failed: ${checkError.message}`);
      }

      if (!existingEntries || existingEntries.length === 0) {
        return {
          success: false,
          message: 'Dictionary not found',
        };
      }

      // If words are provided, replace all entries
      if (updateDto.words && updateDto.words.length > 0) {
        // Delete existing entries
        const { error: deleteError } = await client
          .from('pseudonym_dictionaries')
          .delete()
          .eq('category', id);

        if (deleteError) {
          throw new Error(`Failed to delete existing entries: ${deleteError.message}`);
        }

        // Insert new entries
        const insertData = updateDto.words.map(word => ({
          data_type: existingEntries[0].data_type, // Keep original data type
          category: updateDto.category || id,
          value: word.trim(),
          locale: updateDto.locale || existingEntries[0].locale || 'en-US',
          frequency_weight: updateDto.frequencyWeight || existingEntries[0].frequency_weight || 1,
          is_active: updateDto.isActive !== undefined ? updateDto.isActive : existingEntries[0].is_active,
        }));

        const { error: insertError } = await client
          .from('pseudonym_dictionaries')
          .insert(insertData);

        if (insertError) {
          throw new Error(`Failed to insert new entries: ${insertError.message}`);
        }
      } else {
        // Update existing entries (metadata only)
        const updateData: any = {};
        if (updateDto.category) updateData.category = updateDto.category;
        if (updateDto.locale) updateData.locale = updateDto.locale;
        if (updateDto.frequencyWeight !== undefined) updateData.frequency_weight = updateDto.frequencyWeight;
        if (updateDto.isActive !== undefined) updateData.is_active = updateDto.isActive;

        const { error: updateError } = await client
          .from('pseudonym_dictionaries')
          .update(updateData)
          .eq('category', id);

        if (updateError) {
          throw new Error(`Failed to update entries: ${updateError.message}`);
        }
      }

      return {
        success: true,
        message: 'Dictionary updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update dictionary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Delete('pseudonym/dictionaries/:id')
  @ApiOperation({ summary: 'Delete pseudonym dictionary' })
  @ApiParam({ name: 'id', description: 'Dictionary ID (category)' })
  @ApiResponse({ status: 200, description: 'Dictionary deleted successfully' })
  @ApiResponse({ status: 404, description: 'Dictionary not found' })
  async deletePseudonymDictionary(@Param('id') id: string) {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Check if dictionary exists
      const { data: existingEntries, error: checkError } = await client
        .from('pseudonym_dictionaries')
        .select('id')
        .eq('category', id);

      if (checkError) {
        throw new Error(`Database query failed: ${checkError.message}`);
      }

      if (!existingEntries || existingEntries.length === 0) {
        return {
          success: false,
          message: 'Dictionary not found',
        };
      }

      // Delete all entries for this category
      const { error: deleteError } = await client
        .from('pseudonym_dictionaries')
        .delete()
        .eq('category', id);

      if (deleteError) {
        throw new Error(`Failed to delete dictionary: ${deleteError.message}`);
      }

      return {
        success: true,
        message: 'Dictionary deleted successfully',
        deletedCount: existingEntries.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete dictionary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Get('pseudonym/mappings')
  @ApiOperation({ summary: 'Get all pseudonym mappings' })
  @ApiQuery({ name: 'dataType', required: false, description: 'Filter by data type' })
  @ApiQuery({ name: 'context', required: false, description: 'Filter by context' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results' })
  @ApiResponse({ status: 200, description: 'List of pseudonym mappings' })
  async getPseudonymMappings(
    @Query('dataType') dataType?: PIIDataType,
    @Query('context') context?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Build query for pseudonym mappings - using actual database structure
      let query = client
        .from('pseudonym_mappings')
        .select('*')
        .order('last_used_at', { ascending: false });

      // Apply filters
      if (dataType) {
        query = query.eq('data_type', dataType);
      }
      
      if (context) {
        query = query.eq('context', context);
      }

      if (limit) {
        query = query.limit(parseInt(limit, 10));
      } else {
        // Default limit to prevent huge queries
        query = query.limit(100);
      }

      const { data: mappings, error } = await query;

      if (error) {
        // If table doesn't exist, return empty result
        if (error.code === '42P01') {
          return {
            mappings: [],
            totalMappings: 0,
            filters: {
              dataType: dataType || 'all',
              context: context || 'all',
              limit: limit || 'all',
            },
            stats: {
              totalByDataType: {},
              totalUsage: 0,
              reversibleCount: 0,
              expiredCount: 0,
            },
          };
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Format mappings using actual database columns
      const formattedMappings = (mappings || []).map(mapping => ({
        id: mapping.id,
        originalValue: '[REDACTED]', // Never expose original values - only hash exists in DB
        originalHash: mapping.original_hash?.substring(0, 8) + '...', // Show partial hash for debugging
        pseudonym: mapping.pseudonym,
        dataType: mapping.data_type,
        context: mapping.context || 'unknown',
        createdAt: mapping.created_at,
        lastUsed: mapping.last_used_at || mapping.created_at,
        usageCount: mapping.usage_count || 1,
        isReversible: mapping.is_reversible || false,
        expiresAt: mapping.expires_at,
        isExpired: mapping.expires_at ? new Date(mapping.expires_at) < new Date() : false,
        createdBySystem: mapping.created_by_system,
      }));

      // Calculate stats using actual data
      const stats = {
        totalByDataType: {} as Record<string, number>,
        totalUsage: formattedMappings.reduce((sum, m) => sum + m.usageCount, 0),
        reversibleCount: formattedMappings.filter(m => m.isReversible).length,
        expiredCount: formattedMappings.filter(m => m.isExpired).length,
      };

      formattedMappings.forEach(mapping => {
        stats.totalByDataType[mapping.dataType] = (stats.totalByDataType[mapping.dataType] || 0) + 1;
      });

      return {
        mappings: formattedMappings,
        totalMappings: formattedMappings.length,
        filters: {
          dataType: dataType || 'all',
          context: context || 'all',
          limit: limit || 'all',
        },
        stats,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to load mappings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mappings: [],
        totalMappings: 0,
      };
    }
  }

  // =====================================
  // INTEGRATED SANITIZATION ENDPOINTS
  // =====================================

  @Post('test')
  @ApiOperation({ summary: 'Test complete sanitization pipeline' })
  @ApiResponse({ status: 200, description: 'Complete sanitization test results' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe())
  async testCompleteSanitization(@Body() testDto: TestSanitizationDto) {
    if (!testDto.text) {
      return {
        success: false,
        message: 'Text is required for testing',
      };
    }

    try {
      const result = await this.dataSanitizationService.testSanitization(testDto.text);
      
      return {
        success: true,
        originalText: testDto.text,
        sanitizedText: result.sanitizedText,
        result: result.result,
        redactionDetails: result.redactionDetails,
        pseudonymizationDetails: result.pseudonymizationDetails,
        processingTime: result.result.processingTimeMs,
      };
    } catch (error) {
      return {
        success: false,
        message: `Sanitization test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Post('sanitize')
  @ApiOperation({ summary: 'Sanitize text with options' })
  @ApiResponse({ status: 200, description: 'Text sanitized successfully' })
  @UsePipes(new ValidationPipe())
  async sanitizeText(@Body() sanitizeDto: TestSanitizationDto) {
    if (!sanitizeDto.text) {
      return {
        success: false,
        message: 'Text is required for sanitization',
      };
    }

    try {
      const result = await this.dataSanitizationService.sanitizeText(sanitizeDto.text, {
        enableRedaction: sanitizeDto.enableRedaction ?? true,
        enablePseudonymization: sanitizeDto.enablePseudonymization ?? true,
        pseudonymizationContext: sanitizeDto.context || 'api-request',
      });
      
      return {
        success: true,
        sanitizedText: result.sanitizedText,
        originalLength: result.originalLength,
        sanitizedLength: result.sanitizedLength,
        processingTime: result.processingTimeMs,
        redactionApplied: !!result.redactionResult,
        pseudonymizationApplied: !!result.pseudonymizationResult,
      };
    } catch (error) {
      return {
        success: false,
        message: `Sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get comprehensive sanitization service statistics' })
  @ApiResponse({ status: 200, description: 'Complete service statistics' })
  async getComprehensiveStats() {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Get service stats
      const stats = await this.dataSanitizationService.getStats();
      const cacheStats = this.dataSanitizationService.getCacheStats();
      
      // Query database for audit log statistics
      const auditStatsPromises = [
        // Total operations by type
        client
          .from('redaction_audit_log')
          .select('operation_type')
          .neq('operation_type', null),
        
        // Operations by data type
        client
          .from('redaction_audit_log')
          .select('data_type, operation_type')
          .neq('data_type', null),
          
        // Recent activity (last 24 hours)
        client
          .from('redaction_audit_log')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
          
        // Pattern usage stats
        client
          .from('redaction_patterns')
          .select('name, usage_count, last_used_at, category')
          .neq('usage_count', null)
          .order('usage_count', { ascending: false })
          .limit(10),
      ];

      const results = await Promise.all(auditStatsPromises);
      const operationTypes = results[0]?.data;
      const opError = results[0]?.error;
      const dataTypes = results[1]?.data;
      const dtError = results[1]?.error;
      const recentActivity = results[2]?.data;
      const raError = results[2]?.error;
      const patternUsage = results[3]?.data;
      const puError = results[3]?.error;

      // Calculate database statistics
      const dbStats = {
        totalOperations: operationTypes?.length || 0,
        operationsByType: this.groupBy(operationTypes || [], 'operation_type'),
        operationsByDataType: this.groupBy(dataTypes || [], 'data_type'),
        recentActivity: {
          last24Hours: recentActivity?.length || 0,
          operations: this.groupBy(recentActivity || [], 'operation_type'),
        },
        topPatterns: (patternUsage || []).map((p: any) => ({
          name: p.name,
          category: p.category,
          usageCount: p.usage_count || 0,
          lastUsed: p.last_used_at,
        })),
        errors: [opError, dtError, raError, puError].filter(Boolean).map(e => e?.message),
      };

      return {
        success: true,
        sanitizationStats: stats,
        cacheStats,
        databaseStats: dbStats,
        timestamp: new Date().toISOString(),
        services: {
          redaction: 'SecretRedactionService',
          piiDetection: 'PIIPatternService', 
          pseudonymization: 'PseudonymizationService',
          orchestration: 'DataSanitizationService',
          database: 'SupabaseService',
        },
      };
    } catch (error) {
      // Fallback to service stats if database fails
      console.error('Database query failed for stats:', error);
      const stats = await this.dataSanitizationService.getStats();
      const cacheStats = this.dataSanitizationService.getCacheStats();
      
      return {
        success: true,
        sanitizationStats: stats,
        cacheStats,
        databaseStats: {
          error: error instanceof Error ? error.message : 'Database unavailable',
        },
        timestamp: new Date().toISOString(),
        services: {
          redaction: 'SecretRedactionService',
          piiDetection: 'PIIPatternService', 
          pseudonymization: 'PseudonymizationService',
          orchestration: 'DataSanitizationService',
          database: 'SupabaseService (Error)',
        },
      };
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for sanitization services' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async healthCheck() {
    try {
      // Test basic functionality
      const testText = 'test@example.com and (555) 123-4567';
      const testResult = await this.dataSanitizationService.testSanitization(testText);
      
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        testResult: {
          originalText: testText,
          sanitizedText: testResult.sanitizedText,
          processingTime: testResult.result.processingTimeMs,
        },
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Helper method to group array by property
  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = item[key];
      if (value) {
        groups[value] = (groups[value] || 0) + 1;
      }
      return groups;
    }, {} as Record<string, number>);
  }

  // Helper method to extract data type from pattern or name
  private extractDataTypeFromPattern(patternRegex: string, name: string): PIIDataType {
    const lowerName = name.toLowerCase();
    const lowerPattern = patternRegex.toLowerCase();
    
    if (lowerName.includes('email') || lowerPattern.includes('@')) return 'email';
    if (lowerName.includes('phone') || lowerPattern.includes('phone')) return 'phone';
    if (lowerName.includes('ssn') || lowerPattern.includes('ssn')) return 'ssn';
    if (lowerName.includes('credit') || lowerName.includes('card')) return 'credit_card';
    if (lowerName.includes('name') || lowerName.includes('person')) return 'name';
    if (lowerName.includes('address') || lowerName.includes('street')) return 'address';
    if (lowerName.includes('ip') || lowerPattern.includes('\\d+\\.\\d+')) return 'ip_address';
    if (lowerName.includes('user') || lowerName.includes('username')) return 'username';
    
    return 'custom';
  }
}