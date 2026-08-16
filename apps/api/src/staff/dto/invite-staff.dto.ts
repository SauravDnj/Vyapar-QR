import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, ValidateNested } from 'class-validator';

export class StaffPermissionsDto {
  @IsBoolean()
  leads!: boolean;

  @IsBoolean()
  reviews!: boolean;

  @IsBoolean()
  analytics!: boolean;

  @IsBoolean()
  billing!: boolean;

  @IsBoolean()
  domains!: boolean;

  @IsBoolean()
  whatsapp!: boolean;

  @IsBoolean()
  menu!: boolean;

  @IsBoolean()
  orders!: boolean;
}

export class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StaffPermissionsDto)
  permissions?: StaffPermissionsDto;
}
