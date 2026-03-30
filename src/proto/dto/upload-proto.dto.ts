import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadProtoDto {
  @ApiProperty({ example: 'My Service Proto' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Description of the proto schema' })
  @IsOptional()
  @IsString()
  description?: string;
}
