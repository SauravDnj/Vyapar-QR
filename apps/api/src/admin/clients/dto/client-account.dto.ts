import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** A Super Admin creating a client's account and business in one go. */
export class CreateClientAccountDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'The password needs at least 8 characters.' })
  @MaxLength(128)
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Enter the business name.' })
  @MaxLength(120)
  businessName!: string;

  /** Optional: put them on a plan straight away. */
  @IsOptional()
  @IsString()
  planId?: string;
}

export class SetClientPasswordDto {
  @IsString()
  @MinLength(8, { message: 'The password needs at least 8 characters.' })
  @MaxLength(128)
  password!: string;
}
