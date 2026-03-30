import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteGrpcDto {
  @ApiProperty({ example: 'uuid-of-proto-schema' })
  @IsString()
  protoId: string;

  @ApiProperty({ example: 'MyService' })
  @IsString()
  serviceName: string;

  @ApiProperty({ example: 'GetUser' })
  @IsString()
  methodName: string;

  @ApiProperty({ example: 'localhost:50051' })
  @IsString()
  targetHost: string;

  @ApiPropertyOptional({ example: { 'Authorization': 'Bearer token' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({ example: { id: '123' } })
  @IsOptional()
  @IsObject()
  requestBody?: Record<string, any>;

  @ApiPropertyOptional({ example: 'env-uuid' })
  @IsOptional()
  @IsString()
  environmentId?: string;
}
