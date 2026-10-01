import {
  IsArray,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MediaDto } from '@gitroom/nestjs-libraries/dtos/media/media.dto';
import { Type } from 'class-transformer';

export const WORDPRESS_RATINGS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

export class WordpressDto {
  @IsString()
  @MinLength(2)
  @IsDefined()
  title: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDto)
  main_image?: MediaDto;

  @IsString()
  @IsDefined()
  type: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  categories?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tags?: number[];

  @IsOptional()
  @IsString()
  @IsIn(['publish', 'draft', 'pending', 'private'])
  status?: string;

  // x-hakt: a review's star rating, sent to the site as WordPress meta.rating (1 to 5 in half steps).
  @IsOptional()
  @IsString()
  @IsIn(['', ...WORDPRESS_RATINGS])
  rating?: string;
}
