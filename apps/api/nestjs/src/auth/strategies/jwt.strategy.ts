import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';
import { SupabaseAuthUserDto } from '../dto/auth.dto';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const supabaseAnonKey = configService.get<string>('supabase.anonKey');
    if (!supabaseAnonKey) {
      throw new Error('Supabase anonymous key is required for JWT strategy');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // We'll let Supabase handle expiration
      secretOrKey: supabaseAnonKey,
      passReqToCallback: true, // We need the request to get the raw token
    });
  }

  async validate(req: Request, payload: any): Promise<SupabaseAuthUserDto> {
    try {
      // Extract the raw JWT token from the request
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      this.logger.debug(`JWT Strategy validating token for user: ${payload.sub}`);
      
      // Verify the token with Supabase
      const supabaseClient = this.supabaseService.getAnonClient();
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        this.logger.warn(`Supabase token validation failed: ${error?.message}`);
        throw new UnauthorizedException('Invalid token');
      }

      // Return the verified user data from Supabase
      const validatedUser: SupabaseAuthUserDto = {
        id: user.id,
        email: user.email,
        aud: user.aud,
        role: user.role,
        app_metadata: user.app_metadata || {},
        user_metadata: user.user_metadata || {},
        phone: user.phone,
        email_confirmed_at: user.email_confirmed_at ? new Date(user.email_confirmed_at) : undefined,
        confirmed_at: user.confirmed_at ? new Date(user.confirmed_at) : undefined,
        last_sign_in_at: user.last_sign_in_at ? new Date(user.last_sign_in_at) : undefined,
        created_at: user.created_at ? new Date(user.created_at) : undefined,
        updated_at: user.updated_at ? new Date(user.updated_at) : undefined,
        identities: user.identities || [],
      };

      return validatedUser;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
} 