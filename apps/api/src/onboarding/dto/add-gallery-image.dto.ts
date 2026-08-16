import { IsString, MinLength } from 'class-validator';

export class AddGalleryImageDto {
  @IsString()
  @MinLength(1)
  imageUrl!: string;
}
