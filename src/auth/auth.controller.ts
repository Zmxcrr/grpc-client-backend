import {
    Controller,
    Post,
    Body,
    Res,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Response, CookieOptions } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    private getAccessCookieOptions(): CookieOptions {
        const isProduction = process.env.NODE_ENV === 'production';

        return {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        };
    }

    @Post('register')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiResponse({ status: 409, description: 'Email or username already in use' })
    async register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) _res: Response) {
        const user = await this.authService.register(dto);
        return { id: user.id, email: user.email, username: user.username, role: user.role };
    }

    @Post('login')
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login and receive JWT cookie' })
    @ApiResponse({ status: 200, description: 'Login successful, sets access_token cookie' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const { user, token } = await this.authService.login(dto);

        res.cookie('access_token', token, this.getAccessCookieOptions());

        return { id: user.id, email: user.email, username: user.username, role: user.role };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiCookieAuth('access_token')
    @ApiOperation({ summary: 'Logout - clear JWT cookie' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@Res({ passthrough: true }) res: Response) {
        res.clearCookie('access_token', {
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });
        return { message: 'Logged out successfully' };
    }
}