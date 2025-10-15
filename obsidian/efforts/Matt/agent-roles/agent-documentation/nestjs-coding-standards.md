# NestJS Coding Standards - Orchestrator AI

**Purpose**: Define coding standards and best practices for NestJS development in the Orchestrator AI API codebase.

**Last Updated**: 2025-10-14

---

## Architecture Principles

### SOLID Principles
- **Single Responsibility**: Each class should have one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable for base types
- **Interface Segregation**: Many specific interfaces better than one general
- **Dependency Inversion**: Depend on abstractions, not concretions

### Architectural Pattern
- NestJS follows Angular-inspired architecture
- Use Modules, Controllers, Services (Providers) pattern
- Leverage Dependency Injection throughout

---

## Project Structure

### Module Organization
```
src/
├── module-name/
│   ├── module-name.module.ts      # Module definition
│   ├── module-name.controller.ts  # HTTP endpoints
│   ├── module-name.service.ts     # Business logic
│   ├── dto/                        # Data Transfer Objects
│   │   ├── create-item.dto.ts
│   │   └── update-item.dto.ts
│   ├── interfaces/                 # TypeScript interfaces
│   │   └── item.interface.ts
│   ├── types/                      # Type definitions
│   └── guards/                     # Route guards
```

### Key Principles
- **One module per domain concept**
- **Separate concerns**: Controllers handle HTTP, Services handle logic
- **Co-locate related files** within module folders

---

## Dependency Injection

### Service Injection
```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly dependency1: Dependency1Service,
    private readonly dependency2: Dependency2Service,
  ) {}
}
```

**Rules**:
- Always use `private readonly` for injected dependencies
- Inject services, not implementations
- Use constructor injection only

### Module Providers
```typescript
@Module({
  providers: [MyService, OtherService],
  exports: [MyService], // Export if needed by other modules
})
export class MyModule {}
```

---

## Controllers

### Structure
```typescript
@Controller('resource-name')
@UseGuards(JwtAuthGuard)
export class ResourceController {
  private readonly logger = new Logger(ResourceController.name);

  constructor(
    private readonly resourceService: ResourceService,
  ) {}

  @Get()
  async list(@Query() query: QueryDto, @CurrentUser() user: UserDto) {
    return this.resourceService.list(query, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDto, @CurrentUser() user: UserDto) {
    return this.resourceService.create(dto, user.id);
  }
}
```

### Best Practices
1. **Keep controllers thin** - delegate to services
2. **Use decorators** for routing, guards, validation
3. **Include Logger** - `private readonly logger = new Logger(ClassName.name)`
4. **Use DTOs** for request/response typing
5. **Always specify HTTP status codes** with `@HttpCode()`
6. **Apply guards at controller level** when all routes need auth

### Route Naming
- Use plural nouns: `/tasks`, `/projects`, `/agents`
- Use kebab-case for multi-word resources: `/user-profiles`
- Nest resources logically: `/projects/:id/tasks`

---

## Services

### Structure
```typescript
@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(
    private readonly repository: ResourceRepository,
    private readonly otherService: OtherService,
  ) {}

  async findById(id: string, userId: string): Promise<Resource> {
    this.logger.debug(`Finding resource ${id} for user ${userId}`);

    const resource = await this.repository.findOne(id);

    if (!resource) {
      throw new NotFoundException(`Resource ${id} not found`);
    }

    // Verify ownership
    if (resource.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return resource;
  }
}
```

### Best Practices
1. **Business logic lives in services**, not controllers
2. **Services are stateless** - no instance state
3. **Use Logger** for debugging and monitoring
4. **Throw HTTP exceptions** (`NotFoundException`, `BadRequestException`)
5. **Validate ownership/permissions** in service layer
6. **Return typed responses** - avoid `any`

---

## Data Transfer Objects (DTOs)

### Validation DTOs
```typescript
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Task description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ['todo', 'in_progress', 'done'] })
  @IsEnum(['todo', 'in_progress', 'done'])
  status: string;
}
```

### Best Practices
1. **Use class-validator decorators** for validation
2. **Use class-transformer decorators** for transformation
3. **Add Swagger/ApiProperty decorators** for documentation
4. **Separate DTOs by operation**: `CreateDto`, `UpdateDto`, `QueryDto`
5. **Use Partial/Pick/Omit** for related DTOs:
   ```typescript
   export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
   ```

---

## Error Handling

### Exception Filters
```typescript
try {
  const result = await this.service.performOperation();
  return result;
} catch (error) {
  this.logger.error('Operation failed', error.stack);
  throw new InternalServerErrorException('Operation failed');
}
```

### Built-in HTTP Exceptions
- `BadRequestException` (400) - Invalid input
- `UnauthorizedException` (401) - Not authenticated
- `ForbiddenException` (403) - Not authorized
- `NotFoundException` (404) - Resource not found
- `ConflictException` (409) - Resource conflict
- `InternalServerErrorException` (500) - Server error

### Custom Exception Filters
```typescript
@Catch(CustomException)
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: CustomException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(400).json({
      statusCode: 400,
      message: exception.message,
    });
  }
}
```

---

## Guards and Middleware

### Authentication Guard
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

### Authorization Guard
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return user && user.roles.includes('admin');
  }
}
```

### Middleware
```typescript
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} ${req.url}`);
    next();
  }
}
```

---

## Testing

### Unit Tests (Services)
```typescript
describe('TasksService', () => {
  let service: TasksService;
  let repository: MockType<TaskRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: TaskRepository,
          useFactory: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get(TaskRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find task by id', async () => {
    const task = { id: '1', title: 'Test' };
    repository.findOne.mockReturnValue(task);

    const result = await service.findById('1', 'user-1');
    expect(result).toEqual(task);
  });
});
```

### Integration Tests (Controllers)
```typescript
describe('TasksController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/tasks (GET)', () => {
    return request(app.getHttpServer())
      .get('/tasks')
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeInstanceOf(Array);
      });
  });
});
```

---

## Logging

### Logger Usage
```typescript
export class MyService {
  private readonly logger = new Logger(MyService.name);

  async doSomething() {
    this.logger.log('Starting operation');
    this.logger.debug('Debug details', { extra: 'data' });
    this.logger.warn('Warning message');
    this.logger.error('Error occurred', error.stack);
  }
}
```

### Log Levels
- `log()` - General info (default)
- `debug()` - Detailed debugging info
- `warn()` - Warning messages
- `error()` - Error messages
- `verbose()` - Extra detail

---

## Code Style

### Formatting
- Use **Prettier** for automatic formatting
- Use **ESLint** for linting
- **2 spaces** for indentation
- **Single quotes** for strings
- **Trailing commas** in multiline

### Naming Conventions
- **Classes**: PascalCase (`TasksController`, `TasksService`)
- **Interfaces**: PascalCase with `I` prefix (`ITask`) or without
- **Variables/Parameters**: camelCase (`userId`, `taskData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Files**: kebab-case (`tasks.controller.ts`, `task-status.service.ts`)

### Documentation
```typescript
/**
 * Creates a new task for the user
 *
 * @param dto - Task creation data
 * @param userId - ID of the user creating the task
 * @returns Created task with ID
 * @throws BadRequestException if validation fails
 */
async createTask(dto: CreateTaskDto, userId: string): Promise<Task> {
  // Implementation
}
```

---

## Orchestrator AI Specific Patterns

### Agent Services
- Extend `BaseAgentRunner` for agent implementations
- Implement mode-specific methods: `handleConverse()`, `handlePlan()`, `handleBuild()`
- Use `TaskRequestDto` and `TaskResponseDto` for agent I/O

### Repository Pattern
- Use dedicated repository services for database access
- Keep Supabase/database logic isolated from business logic

### Authentication
- Use `JwtAuthGuard` for route protection
- Use `@CurrentUser()` decorator to get authenticated user
- Validate user ownership in service layer

---

## Common Anti-Patterns to Avoid

❌ **Don't** put business logic in controllers
❌ **Don't** use `any` type
❌ **Don't** skip validation on DTOs
❌ **Don't** access request/response directly in services
❌ **Don't** create circular dependencies between modules
❌ **Don't** forget to log errors
❌ **Don't** skip unit tests

✅ **Do** keep controllers thin
✅ **Do** use proper types everywhere
✅ **Do** validate all inputs
✅ **Do** inject dependencies via constructor
✅ **Do** organize code into modules
✅ **Do** log important operations
✅ **Do** write tests for services

---

## References

- [NestJS Official Documentation](https://docs.nestjs.com/)
- [NestJS Best Practices](https://docs.nestjs.com/fundamentals/testing)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**Version**: 1.0
**Maintained By**: API Development Team
