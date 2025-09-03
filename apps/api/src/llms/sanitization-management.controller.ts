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
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';

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

@ApiTags('Sanitization Management')
@Controller('sanitization')
export class SanitizationManagementController {
  constructor(
    private readonly secretRedactionService: SecretRedactionService,
    private readonly piiPatternService: PIIPatternService,
    private readonly pseudonymizationService: PseudonymizationService,
    private readonly dataSanitizationService: DataSanitizationService,
  ) {}

  // =====================================
  // REDACTION PATTERN ENDPOINTS
  // =====================================

  @Get('redaction/patterns')
  @ApiOperation({ summary: 'Get all redaction patterns' })
  @ApiResponse({ status: 200, description: 'List of redaction patterns' })
  async getRedactionPatterns() {
    const patterns = this.secretRedactionService.getRedactionPatterns();
    const stats = this.secretRedactionService.getStats();
    
    return {
      patterns,
      stats,
      totalPatterns: patterns.length,
    };
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
    const allPatterns = this.piiPatternService.getAllPatterns();
    const filteredPatterns = dataType 
      ? allPatterns.filter(p => p.dataType === dataType)
      : allPatterns;
    
    const stats = this.piiPatternService.getStats();
    
    return {
      patterns: filteredPatterns,
      stats,
      totalPatterns: filteredPatterns.length,
      dataTypes: ['email', 'phone', 'name', 'address', 'ip_address', 'username', 'credit_card', 'ssn', 'custom'],
    };
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
    const stats = await this.dataSanitizationService.getStats();
    const cacheStats = this.dataSanitizationService.getCacheStats();
    
    return {
      success: true,
      sanitizationStats: stats,
      cacheStats,
      timestamp: new Date().toISOString(),
      services: {
        redaction: 'SecretRedactionService',
        piiDetection: 'PIIPatternService', 
        pseudonymization: 'PseudonymizationService',
        orchestration: 'DataSanitizationService',
      },
    };
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
}