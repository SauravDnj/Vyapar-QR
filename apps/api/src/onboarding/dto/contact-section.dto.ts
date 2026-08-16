import { IsOptional, IsString } from 'class-validator';

export class ContactSectionDto {
  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  bookingUrl?: string;
}
