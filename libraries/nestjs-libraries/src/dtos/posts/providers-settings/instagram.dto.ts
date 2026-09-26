import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class Collaborators {
  @IsDefined()
  @IsString()
  label: string;
}

export class InstagramAudio {
  @IsDefined()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  artist?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  audio_volume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  video_volume?: number;
}
export class InstagramDto {
  // x-hakt: 'reel' is its own choice (was folded into 'post'); a video 'post' still goes out as
  // a Reel shared to the feed, as before.
  @IsIn(['post', 'reel', 'story'])
  @IsDefined()
  post_type: 'post' | 'reel' | 'story';

  // x-hakt: Reels only. Show the Reel in the main feed as well as the Reels tab (default true).
  @IsOptional()
  share_to_feed?: boolean;

  // x-hakt: Meta's AI self-disclosure label ("AI info"). Must be set at publish time; it can't
  // be added or removed afterwards.
  @IsOptional()
  is_ai_generated?: boolean;

  @IsOptional()
  is_trial_reel?: boolean;

  @IsIn(['MANUAL', 'SS_PERFORMANCE'])
  @IsOptional()
  graduation_strategy?: 'MANUAL' | 'SS_PERFORMANCE';

  @Type(() => Collaborators)
  @ValidateNested({ each: true })
  @IsArray()
  @IsOptional()
  collaborators: Collaborators[];

  @Type(() => InstagramAudio)
  @ValidateNested()
  @IsOptional()
  audio?: InstagramAudio;
}
