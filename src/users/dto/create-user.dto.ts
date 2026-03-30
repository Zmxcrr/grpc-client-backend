import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'johndoe' })
    @IsString()
    @MinLength(3)
    @MaxLength(30)
    username: string;

    @ApiProperty({ example: 'StrongPassword123!' })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;
}